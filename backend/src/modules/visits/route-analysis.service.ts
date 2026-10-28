import { badRequest } from '../../lib/errors.js';
import { haversineMeters } from '../../shared/geo.js';
import { idString, toObjectId, type LatLng } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { findAgentInScope } from '../agents/agent.service.js';
import { Assignment } from '../assignments/assignment.model.js';
import { orgDayOf } from '../organizations/settings-cache.js';
import { RoutePlan } from '../routing/route-plan.model.js';
import { LocationTelemetry } from '../tracking/telemetry.model.js';
import { findContaining, getOrgGeofences } from './geofence-index.js';
import { Visit } from './visit.model.js';
import type { RouteAnalysisDto, RouteAnalysisQuery } from './visit.schemas.js';

export const STOP_RADIUS_M = 50;
export const STOP_MIN_DURATION_MS = 3 * 60_000;
export const GAP_MIN_MS = 2 * 60_000;
const MAX_WINDOW_MS = 24 * 3_600_000;
const DEFAULT_WINDOW_MS = 12 * 3_600_000;
const MAX_POINTS = 20_000;

export interface TimedPoint extends LatLng {
  t: number;
}

export interface DetectedStop {
  start: number;
  end: number;
  center: LatLng;
}

/**
 * Stops: maximal runs of fixes staying within `radiusM` of the run's first fix for at least
 * `minDurationMs`. Simple, explainable and robust to GPS jitter below the radius.
 */
export function detectStops(
  points: TimedPoint[],
  radiusM = STOP_RADIUS_M,
  minDurationMs = STOP_MIN_DURATION_MS,
): DetectedStop[] {
  const stops: DetectedStop[] = [];
  let i = 0;
  while (i < points.length) {
    const anchor = points[i]!;
    let j = i;
    while (j + 1 < points.length && haversineMeters(anchor, points[j + 1]!) <= radiusM) j++;
    if (points[j]!.t - anchor.t >= minDurationMs) {
      const run = points.slice(i, j + 1);
      stops.push({
        start: anchor.t,
        end: points[j]!.t,
        center: {
          lat: run.reduce((sum, p) => sum + p.lat, 0) / run.length,
          lng: run.reduce((sum, p) => sum + p.lng, 0) / run.length,
        },
      });
      i = j + 1;
    } else {
      i++;
    }
  }
  return stops;
}

/** Gaps: consecutive fixes further apart in time than `minGapMs`. */
export function detectGaps(
  points: TimedPoint[],
  minGapMs = GAP_MIN_MS,
): { from: number; to: number }[] {
  const gaps: { from: number; to: number }[] = [];
  for (let k = 1; k < points.length; k++) {
    if (points[k]!.t - points[k - 1]!.t > minGapMs)
      gaps.push({ from: points[k - 1]!.t, to: points[k]!.t });
  }
  return gaps;
}

/** True when visits happened in a different order than planned. */
export function isOutOfOrder(actualOrders: (number | null)[]): boolean {
  const visited = actualOrders.filter((order): order is number => order !== null);
  return visited.some((order, index) => index > 0 && order < visited[index - 1]!);
}

export async function getRouteAnalysis(
  actor: Actor,
  agentId: string,
  query: RouteAnalysisQuery,
): Promise<RouteAnalysisDto> {
  const profile = await findAgentInScope(actor, agentId);
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_WINDOW_MS);
  if (from >= to) throw badRequest('from must be before to');
  if (to.getTime() - from.getTime() > MAX_WINDOW_MS)
    throw badRequest('The time window may span at most 24 hours');

  const docs = await LocationTelemetry.find({
    'meta.orgId': toObjectId(actor.orgId),
    'meta.agentId': profile._id,
    recordedAt: { $gte: from, $lte: to },
  })
    .sort({ recordedAt: 1 })
    .limit(MAX_POINTS)
    .select('lat lng recordedAt')
    .lean();
  const points: TimedPoint[] = docs.map((d) => ({
    lat: d.lat,
    lng: d.lng,
    t: d.recordedAt.getTime(),
  }));

  let distanceM = 0;
  for (let k = 1; k < points.length; k++) distanceM += haversineMeters(points[k - 1]!, points[k]!);

  const fences = await getOrgGeofences(actor.orgId);
  const stops = detectStops(points).map((stop) => {
    const fence = findContaining(fences, stop.center);
    return {
      start: new Date(stop.start).toISOString(),
      end: new Date(stop.end).toISOString(),
      durationSec: Math.round((stop.end - stop.start) / 1000),
      position: stop.center,
      locationId: fence?.locationId ?? null,
      locationName: fence?.name ?? null,
      kind: fence ? ('client_site' as const) : ('unplanned' as const),
    };
  });
  const gaps = detectGaps(points).map((gap) => ({
    from: new Date(gap.from).toISOString(),
    to: new Date(gap.to).toISOString(),
    durationSec: Math.round((gap.to - gap.from) / 1000),
  }));

  const spanSec = points.length > 1 ? (points[points.length - 1]!.t - points[0]!.t) / 1000 : 0;
  const stoppedTimeSec = stops.reduce((sum, s) => sum + s.durationSec, 0);
  const gapSec = gaps.reduce((sum, g) => sum + g.durationSec, 0);

  // Planned vs actual for the day(s) covered by the window.
  const [dayFrom, dayTo] = await Promise.all([
    orgDayOf(actor.orgId, from),
    orgDayOf(actor.orgId, to),
  ]);
  const scheduled = await Assignment.find({
    orgId: actor.orgId,
    agentId: profile._id,
    scheduledDate: { $gte: dayFrom, $lte: dayTo },
    status: { $ne: 'cancelled' },
  })
    .sort({ scheduledDate: 1, 'window.start': 1, createdAt: 1 })
    .select('locationId status scheduledDate')
    .lean();
  // A saved route plan defines the planned order; otherwise window start / creation order.
  const plans = await RoutePlan.find({
    orgId: actor.orgId,
    agentId: profile._id,
    date: { $gte: dayFrom, $lte: dayTo },
    status: 'active',
  })
    .select('date stops.assignmentId stops.sequence')
    .lean();
  const plannedSeq = new Map<string, number>();
  for (const plan of plans) {
    for (const stop of plan.stops) plannedSeq.set(idString(stop.assignmentId), stop.sequence);
  }
  const assignments = scheduled
    .map((a, index) => ({ a, index }))
    .sort(
      (x, y) =>
        x.a.scheduledDate.localeCompare(y.a.scheduledDate) ||
        (plannedSeq.get(idString(x.a._id)) ?? 1000 + x.index) -
          (plannedSeq.get(idString(y.a._id)) ?? 1000 + y.index),
    )
    .map(({ a }) => a);
  const visits = await Visit.find({
    orgId: actor.orgId,
    assignmentId: { $in: assignments.map((a) => a._id) },
    status: { $ne: 'missed' },
  })
    .select('assignmentId status checkInAt')
    .lean();
  const visitByAssignment = new Map(visits.map((v) => [idString(v.assignmentId!), v]));
  const visitedInOrder = [...visits]
    .filter((v) => v.checkInAt)
    .sort((a, b) => a.checkInAt!.getTime() - b.checkInAt!.getTime())
    .map((v) => idString(v.assignmentId!));
  const names = new Map(fences.map((f) => [f.locationId, f.name]));

  const plan = assignments.map((assignment, index) => {
    const visit = visitByAssignment.get(idString(assignment._id));
    const actualIndex = visitedInOrder.indexOf(idString(assignment._id));
    return {
      assignmentId: idString(assignment._id),
      locationId: idString(assignment.locationId),
      locationName: names.get(idString(assignment.locationId)) ?? null,
      plannedOrder: index + 1,
      actualOrder: actualIndex === -1 ? null : actualIndex + 1,
      visitId: visit ? idString(visit._id) : null,
      visitStatus: visit?.status ?? null,
      assignmentStatus: assignment.status,
    };
  });

  return {
    agentId: idString(profile._id),
    from: from.toISOString(),
    to: to.toISOString(),
    pointCount: points.length,
    distanceM: Math.round(distanceM),
    movingTimeSec: Math.max(0, Math.round(spanSec - stoppedTimeSec - gapSec)),
    stoppedTimeSec,
    stops,
    gaps,
    plan,
    outOfOrder: isOutOfOrder(plan.map((p) => p.actualOrder)),
  };
}
