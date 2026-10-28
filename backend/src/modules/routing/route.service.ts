import type { Types } from 'mongoose';
import { badRequest, notFound } from '../../lib/errors.js';
import { publishRouteUpdated } from '../../realtime/publisher.js';
import { idString, toLatLng, toObjectId, type LatLng } from '../../shared/schemas.js';
import { zonedDayStart } from '../../shared/time.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile } from '../agents/agent.model.js';
import { findAgentInScope } from '../agents/agent.service.js';
import { Assignment } from '../assignments/assignment.model.js';
import { recordAudit } from '../audit/audit.service.js';
import { ClientLocation } from '../locations/location.model.js';
import { getOrgSettings, getOrgTimezone, orgDayOf } from '../organizations/settings-cache.js';
import { resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { getLatestFixes } from '../tracking/live-state.js';
import { evaluate, optimizeOrder, type OptStop, type Schedule } from './optimizer.js';
import { routeGeometry, travelMatrix } from './providers.js';
import { RoutePlan, type RoutePlanDoc, type StartSource } from './route-plan.model.js';
import {
  MAX_ROUTE_STOPS,
  type ListRoutesQuery,
  type PlanRouteBody,
  type RoutePlanDto,
} from './route.schemas.js';

/** A live fix older than this is not "current" any more. */
const CURRENT_FIX_MAX_AGE_MS = 15 * 60_000;
const OPEN_STATUSES = ['pending', 'overdue', 'in_progress'] as const;

const iso = (ms: number) => new Date(ms).toISOString();

function totals(schedule: Schedule, departAt: number) {
  return {
    distanceM: Math.round(schedule.distanceM),
    durationSec: Math.round((schedule.finish - departAt) / 1000),
    travelSec: Math.round(schedule.travelSec),
    waitSec: Math.round(schedule.waitSec),
    lateSec: Math.round(schedule.lateSec),
    lateStops: schedule.lateStops,
  };
}

interface PlanContext {
  profile: { _id: Types.ObjectId; teamId: Types.ObjectId | null };
  date: string;
  departAt: number;
  returnToStart: boolean;
  start: { position: LatLng; source: StartSource };
  stops: {
    assignmentId: Types.ObjectId;
    locationId: Types.ObjectId;
    locationName: string | null;
    title: string | null;
    position: LatLng;
    opt: OptStop;
  }[];
  warnings: string[];
}

async function buildContext(actor: Actor, body: PlanRouteBody): Promise<PlanContext> {
  const profile = await findAgentInScope(actor, body.agentId);
  const date = body.date ?? (await orgDayOf(actor.orgId));
  const warnings: string[] = [];

  const assignments = await Assignment.find({
    orgId: actor.orgId,
    agentId: profile._id,
    ...(body.assignmentIds
      ? { _id: { $in: body.assignmentIds.map(toObjectId) } }
      : { scheduledDate: date }),
    status: { $in: [...OPEN_STATUSES] },
  })
    .sort({ 'window.start': 1, createdAt: 1 })
    .lean();
  if (body.assignmentIds && assignments.length !== body.assignmentIds.length) {
    throw badRequest('Some assignments are not open assignments of this agent');
  }
  if (assignments.length === 0) throw badRequest('No open assignments to plan for this day');
  if (assignments.length > MAX_ROUTE_STOPS)
    throw badRequest(`At most ${MAX_ROUTE_STOPS} stops can be planned at once`);

  const locations = await ClientLocation.find({
    orgId: actor.orgId,
    _id: { $in: assignments.map((a) => a.locationId) },
  })
    .select('name point')
    .lean();
  const locationById = new Map(locations.map((l) => [idString(l._id), l]));
  const serviceSec = Math.round(body.serviceMin * 60);
  const stops = assignments.map((a) => {
    const location = locationById.get(idString(a.locationId));
    if (!location) throw badRequest('An assignment references a missing location');
    return {
      assignmentId: a._id,
      locationId: a.locationId,
      locationName: location.name,
      title: a.title ?? null,
      position: toLatLng(location.point.coordinates),
      opt: {
        serviceSec,
        window: a.window ? { start: a.window.start.getTime(), end: a.window.end.getTime() } : null,
        priority: a.priority,
      },
    };
  });

  // Start point.
  let start: PlanContext['start'];
  if (body.start.type === 'position') start = { position: body.start.position, source: 'custom' };
  else if (body.start.type === 'first_stop')
    start = { position: stops[0]!.position, source: 'first_stop' };
  else {
    const live = (await getLatestFixes(actor.orgId, [idString(profile._id)])).get(
      idString(profile._id),
    );
    if (live && Date.now() - live.recordedAt < CURRENT_FIX_MAX_AGE_MS) {
      start = { position: { lat: live.lat, lng: live.lng }, source: 'current' };
    } else if (profile.lastLocation) {
      start = { position: toLatLng(profile.lastLocation.point.coordinates), source: 'last_known' };
      warnings.push('No recent GPS: starting from the last known position.');
    } else {
      start = { position: stops[0]!.position, source: 'first_stop' };
      warnings.push('No GPS position for this agent: starting at the first stop.');
    }
  }

  // Departure time.
  let departAt: number;
  if (body.departAt) departAt = Date.parse(body.departAt);
  else {
    const [today, settings, timeZone] = await Promise.all([
      orgDayOf(actor.orgId),
      getOrgSettings(actor.orgId),
      getOrgTimezone(actor.orgId),
    ]);
    const [h, m] = settings.workingHours.start.split(':').map(Number) as [number, number];
    const workStart = zonedDayStart(date, timeZone).getTime() + (h * 60 + m) * 60_000;
    departAt = date === today ? Math.max(Date.now(), workStart) : workStart;
  }

  return {
    profile: { _id: profile._id, teamId: profile.teamId },
    date,
    departAt,
    returnToStart: body.returnToStart,
    start,
    stops,
    warnings,
  };
}

function toPlanDto(
  ctx: PlanContext,
  schedule: Schedule,
  baseline: Schedule | null,
  extra: {
    provider: RoutePlanDto['provider'];
    fallbackReason: string | null;
    geometry: LatLng[];
    id?: Types.ObjectId;
    status?: RoutePlanDto['status'];
    createdAt?: Date;
  },
): RoutePlanDto {
  const warnings = [...ctx.warnings];
  if (extra.provider === 'builtin')
    warnings.push('ETAs are straight-line estimates (no road network or traffic).');
  if (schedule.lateStops > 0)
    warnings.push(`${schedule.lateStops} stop(s) cannot be reached within their time window.`);
  return {
    id: extra.id ? idString(extra.id) : null,
    agentId: idString(ctx.profile._id),
    teamId: ctx.profile.teamId ? idString(ctx.profile.teamId) : null,
    date: ctx.date,
    status: extra.status ?? null,
    provider: extra.provider,
    fallbackReason: extra.fallbackReason,
    start: ctx.start,
    departAt: iso(ctx.departAt),
    returnToStart: ctx.returnToStart,
    stops: schedule.stops.map((s, index) => {
      const stop = ctx.stops[s.stop]!;
      return {
        sequence: index + 1,
        assignmentId: idString(stop.assignmentId),
        locationId: idString(stop.locationId),
        locationName: stop.locationName,
        title: stop.title,
        position: stop.position,
        priority: stop.opt.priority,
        window: stop.opt.window
          ? { start: iso(stop.opt.window.start), end: iso(stop.opt.window.end) }
          : null,
        serviceSec: stop.opt.serviceSec,
        eta: iso(s.arrival),
        departure: iso(s.departure),
        waitSec: Math.round(s.waitSec),
        lateSec: Math.round(s.lateSec),
        legDistanceM: Math.round(s.legM),
        legDurationSec: Math.round(s.legSec),
      };
    }),
    totals: totals(schedule, ctx.departAt),
    baseline: baseline ? totals(baseline, ctx.departAt) : null,
    geometry: extra.geometry,
    warnings,
    createdAt: extra.createdAt ? extra.createdAt.toISOString() : null,
  };
}

async function computePlan(actor: Actor, body: PlanRouteBody) {
  const ctx = await buildContext(actor, body);
  const points = [ctx.start.position, ...ctx.stops.map((s) => s.position)];
  const routing = await travelMatrix(points);
  const opt = ctx.stops.map((s) => s.opt);
  const schedule = optimizeOrder(opt, routing.matrix, ctx.departAt, ctx.returnToStart);
  const baseline = evaluate(
    opt.map((_, i) => i),
    opt,
    routing.matrix,
    ctx.departAt,
    ctx.returnToStart,
  );
  const ordered = [
    ctx.start.position,
    ...schedule.order.map((i) => ctx.stops[i]!.position),
    ...(ctx.returnToStart ? [ctx.start.position] : []),
  ];
  const geometry = await routeGeometry(ordered, routing.provider);
  return { ctx, schedule, baseline, routing, geometry };
}

/** Optimized stop order with ETAs — a preview, nothing is saved. */
export async function previewRoute(actor: Actor, body: PlanRouteBody): Promise<RoutePlanDto> {
  const { ctx, schedule, baseline, routing, geometry } = await computePlan(actor, body);
  return toPlanDto(ctx, schedule, baseline, { ...routing, geometry });
}

/**
 * Computes and saves the plan as the agent's active route for the day (the previous one is
 * superseded), links the assignments, audits and notifies the agent and dashboards.
 */
export async function saveRoute(actor: Actor, body: PlanRouteBody): Promise<RoutePlanDto> {
  const { ctx, schedule, baseline, routing, geometry } = await computePlan(actor, body);
  const filter = { orgId: actor.orgId, agentId: ctx.profile._id, date: ctx.date };
  await RoutePlan.updateMany({ ...filter, status: 'active' }, { $set: { status: 'superseded' } });
  const doc = (
    await RoutePlan.create({
      ...filter,
      teamId: ctx.profile.teamId,
      status: 'active',
      provider: routing.provider,
      start: { ...ctx.start.position, source: ctx.start.source },
      departAt: new Date(ctx.departAt),
      returnToStart: ctx.returnToStart,
      stops: schedule.stops.map((s, index) => {
        const stop = ctx.stops[s.stop]!;
        return {
          sequence: index + 1,
          assignmentId: stop.assignmentId,
          locationId: stop.locationId,
          lat: stop.position.lat,
          lng: stop.position.lng,
          priority: stop.opt.priority,
          windowStart: stop.opt.window ? new Date(stop.opt.window.start) : null,
          windowEnd: stop.opt.window ? new Date(stop.opt.window.end) : null,
          serviceSec: stop.opt.serviceSec,
          eta: new Date(s.arrival),
          departure: new Date(s.departure),
          waitSec: Math.round(s.waitSec),
          lateSec: Math.round(s.lateSec),
          legDistanceM: Math.round(s.legM),
          legDurationSec: Math.round(s.legSec),
        };
      }),
      totals: totals(schedule, ctx.departAt),
      geometry,
      createdBy: actor.userId,
    })
  ).toObject();

  await Assignment.updateMany(
    { orgId: actor.orgId, _id: { $in: ctx.stops.map((s) => s.assignmentId) } },
    { $set: { routeId: doc._id } },
  );
  await recordAudit(actor, {
    action: 'route.planned',
    entityType: 'route',
    entityId: doc._id,
    metadata: {
      agentId: idString(ctx.profile._id),
      date: ctx.date,
      stops: ctx.stops.length,
      provider: routing.provider,
      distanceM: doc.totals.distanceM,
    },
  });
  const dto = toPlanDto(ctx, schedule, baseline, {
    ...routing,
    geometry,
    id: doc._id,
    status: 'active',
    createdAt: doc.createdAt,
  });
  publishRouteUpdated(actor.orgId, dto);
  return dto;
}

/** Stored plan → DTO (names resolved now; baseline not stored). */
async function storedToDto(orgId: string, doc: RoutePlanDoc): Promise<RoutePlanDto> {
  const [locations, assignments] = await Promise.all([
    ClientLocation.find({ orgId, _id: { $in: doc.stops.map((s) => s.locationId) } })
      .select('name')
      .lean(),
    Assignment.find({ orgId, _id: { $in: doc.stops.map((s) => s.assignmentId) } })
      .select('title')
      .lean(),
  ]);
  const names = new Map(locations.map((l) => [idString(l._id), l.name]));
  const titles = new Map(assignments.map((a) => [idString(a._id), a.title ?? null]));
  const warnings: string[] = [];
  if (doc.provider === 'builtin')
    warnings.push('ETAs are straight-line estimates (no road network or traffic).');
  if (doc.totals.lateStops > 0)
    warnings.push(`${doc.totals.lateStops} stop(s) cannot be reached within their time window.`);
  return {
    id: idString(doc._id),
    agentId: idString(doc.agentId),
    teamId: doc.teamId ? idString(doc.teamId) : null,
    date: doc.date,
    status: doc.status,
    provider: doc.provider,
    fallbackReason: null,
    start: { position: { lat: doc.start.lat, lng: doc.start.lng }, source: doc.start.source },
    departAt: doc.departAt.toISOString(),
    returnToStart: doc.returnToStart,
    stops: doc.stops.map((s) => ({
      sequence: s.sequence,
      assignmentId: idString(s.assignmentId),
      locationId: idString(s.locationId),
      locationName: names.get(idString(s.locationId)) ?? null,
      title: titles.get(idString(s.assignmentId)) ?? null,
      position: { lat: s.lat, lng: s.lng },
      priority: s.priority,
      window:
        s.windowStart && s.windowEnd
          ? { start: s.windowStart.toISOString(), end: s.windowEnd.toISOString() }
          : null,
      serviceSec: s.serviceSec,
      eta: s.eta.toISOString(),
      departure: s.departure.toISOString(),
      waitSec: s.waitSec,
      lateSec: s.lateSec,
      legDistanceM: s.legDistanceM,
      legDurationSec: s.legDurationSec,
    })),
    totals: { ...doc.totals },
    baseline: null,
    geometry: doc.geometry.map((p) => ({ lat: p.lat, lng: p.lng })),
    warnings,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Active plans of a day (default today) within the caller's team scope. */
export async function listRoutes(actor: Actor, query: ListRoutesQuery): Promise<RoutePlanDto[]> {
  const date = query.date ?? (await orgDayOf(actor.orgId));
  const scope = await resolveTeamScope(actor);
  const docs = await RoutePlan.find({
    orgId: actor.orgId,
    date,
    status: 'active',
    ...teamScopeFilter(scope),
    ...(query.agentId ? { agentId: toObjectId(query.agentId) } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  return Promise.all(docs.map((doc) => storedToDto(actor.orgId, doc)));
}

/** The calling agent's active plan for a day (driver app), or 404. */
export async function getMyRoute(actor: Actor, date?: string): Promise<RoutePlanDto> {
  const profile = await AgentProfile.findOne({ orgId: actor.orgId, userId: actor.userId })
    .select('_id')
    .lean();
  if (!profile) throw notFound('Agent profile');
  const doc = await RoutePlan.findOne({
    orgId: actor.orgId,
    agentId: profile._id,
    date: date ?? (await orgDayOf(actor.orgId)),
    status: 'active',
  }).lean();
  if (!doc) throw notFound('Route');
  return storedToDto(actor.orgId, doc);
}
