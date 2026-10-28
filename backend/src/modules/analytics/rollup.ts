import type { Types } from 'mongoose';
import { logger } from '../../lib/logger.js';
import { getRedis } from '../../lib/redis.js';
import { haversineMeters } from '../../shared/geo.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import { addDays, zonedDayBounds } from '../../shared/time.js';
import { AgentProfile } from '../agents/agent.model.js';
import { Anomaly } from '../anomalies/anomaly.model.js';
import { Assignment } from '../assignments/assignment.model.js';
import { Organization } from '../organizations/organization.model.js';
import { getOrgTimezone, orgDayOf } from '../organizations/settings-cache.js';
import { LocationTelemetry } from '../tracking/telemetry.model.js';
import { TrackingSession } from '../tracking/tracking-session.model.js';
import { Visit } from '../visits/visit.model.js';
import { DailyAgentStats, RollupRun, type DailyAgentStatsDoc } from './daily-stats.model.js';

export type DayStats = Omit<DailyAgentStatsDoc, '_id'>;

/** Fixes worse than this are left out of the distance (they zig-zag and inflate it). */
const DISTANCE_MAX_ACCURACY_M = 100;
/** Segments faster than this are GPS jumps, not travel. */
const DISTANCE_MAX_SPEED_MPS = 70;
/** Finished days younger than this are recomputed so late reviews/uploads are counted. */
export const REFRESH_DAYS = 7;
const REFRESH_AFTER_MS = 3_600_000;
const LOCK_KEY = 'lock:analytics-rollup';

function emptyStats(orgId: Types.ObjectId, agentId: Types.ObjectId, day: string): DayStats {
  return {
    orgId,
    agentId,
    teamId: null,
    day,
    distanceM: 0,
    shiftSec: 0,
    sampleCount: 0,
    visits: {
      total: 0,
      verified: 0,
      needsReview: 0,
      rejected: 0,
      missed: 0,
      inProgress: 0,
      onTime: 0,
      late: 0,
      dwellSecTotal: 0,
      dwellCount: 0,
    },
    assignments: { total: 0, completed: 0 },
    anomalies: { total: 0, high: 0, byType: {} },
    computedAt: new Date(),
  };
}

/**
 * KPIs of every agent with any activity on one local day of an organization. Reads raw data
 * (telemetry, sessions, visits, assignments, anomalies); safe to run repeatedly.
 */
export async function computeDayStats(
  orgId: string,
  day: string,
  now = new Date(),
): Promise<DayStats[]> {
  const org = toObjectId(orgId);
  const { start, end } = zonedDayBounds(day, await getOrgTimezone(orgId));
  const until = end < now ? end : now;
  const rows = new Map<string, DayStats>();
  const row = (agentId: Types.ObjectId) => {
    const key = idString(agentId);
    let stats = rows.get(key);
    if (!stats) {
      stats = emptyStats(org, agentId, day);
      rows.set(key, stats);
    }
    return stats;
  };

  // Shift time (overlap of each session with the day).
  const sessions = await TrackingSession.find({
    orgId,
    startedAt: { $lt: until },
    $or: [{ endedAt: null }, { endedAt: { $gt: start } }],
  })
    .select('agentId startedAt endedAt')
    .lean();
  for (const session of sessions) {
    const from = Math.max(session.startedAt.getTime(), start.getTime());
    const to = Math.min((session.endedAt ?? until).getTime(), until.getTime());
    if (to > from) row(session.agentId).shiftSec += Math.round((to - from) / 1000);
  }

  // Distance from accurate consecutive fixes.
  const cursor = LocationTelemetry.find({
    'meta.orgId': org,
    recordedAt: { $gte: start, $lt: end },
  })
    .sort({ 'meta.agentId': 1, recordedAt: 1 })
    .select('meta.agentId lat lng accuracyM recordedAt')
    .lean()
    .cursor();
  let lastAgent: string | null = null;
  let last: { lat: number; lng: number; t: number } | null = null;
  for await (const fix of cursor) {
    const agentKey = idString(fix.meta.agentId);
    const stats = row(fix.meta.agentId);
    stats.sampleCount += 1;
    if (agentKey !== lastAgent) {
      lastAgent = agentKey;
      last = null;
    }
    if (fix.accuracyM > DISTANCE_MAX_ACCURACY_M) continue;
    const point = { lat: fix.lat, lng: fix.lng, t: fix.recordedAt.getTime() };
    if (last) {
      const meters = haversineMeters(last, point);
      const sec = (point.t - last.t) / 1000;
      if (sec > 0 && meters / sec <= DISTANCE_MAX_SPEED_MPS) stats.distanceM += meters;
    }
    last = point;
  }

  const visits = await Visit.find({ orgId, visitDate: day })
    .select('agentId status durationSec arrival isOpen')
    .lean();
  for (const visit of visits) {
    const v = row(visit.agentId).visits;
    v.total += 1;
    if (visit.status === 'verified') v.verified += 1;
    else if (visit.status === 'needs_review') v.needsReview += 1;
    else if (visit.status === 'rejected') v.rejected += 1;
    else if (visit.status === 'missed') v.missed += 1;
    else if (visit.status === 'in_progress') v.inProgress += 1;
    if (visit.arrival) {
      if (visit.arrival.onTime) v.onTime += 1;
      else v.late += 1;
    }
    if (!visit.isOpen && visit.status !== 'missed' && visit.durationSec !== null) {
      v.dwellSecTotal += visit.durationSec;
      v.dwellCount += 1;
    }
  }

  const assignments = await Assignment.find({
    orgId,
    scheduledDate: day,
    status: { $ne: 'cancelled' },
  })
    .select('agentId status')
    .lean();
  for (const assignment of assignments) {
    const a = row(assignment.agentId).assignments;
    a.total += 1;
    if (assignment.status === 'completed') a.completed += 1;
  }

  const anomalies = await Anomaly.find({ orgId, firstSeenAt: { $gte: start, $lt: end } })
    .select('agentId type severity')
    .lean();
  for (const anomaly of anomalies) {
    const a = row(anomaly.agentId).anomalies;
    a.total += 1;
    if (anomaly.severity === 'high') a.high += 1;
    a.byType[anomaly.type] = (a.byType[anomaly.type] ?? 0) + 1;
  }

  // Team as of now (agents rarely move; history of team changes is not tracked).
  const profiles = await AgentProfile.find({ orgId, _id: { $in: [...rows.keys()] } })
    .select('teamId')
    .lean();
  const teams = new Map(profiles.map((p) => [idString(p._id), p.teamId]));
  const computedAt = new Date();
  for (const [agentId, stats] of rows) {
    stats.teamId = teams.get(agentId) ?? null;
    stats.distanceM = Math.round(stats.distanceM);
    stats.computedAt = computedAt;
  }
  return [...rows.values()];
}

/** Replaces the stored rows of one finished day. */
export async function rollupDay(orgId: string, day: string): Promise<number> {
  const rows = await computeDayStats(orgId, day);
  await DailyAgentStats.deleteMany({ orgId, day });
  if (rows.length > 0) await DailyAgentStats.insertMany(rows, { ordered: false });
  await RollupRun.updateOne({ orgId, day }, { $set: { computedAt: new Date() } }, { upsert: true });
  return rows.length;
}

/**
 * Makes sure finished days in `[from, to]` are rolled up: missing days are computed, and days in
 * the refresh window whose rollup is older than an hour are recomputed. Returns days computed.
 */
export async function ensureRollups(
  orgId: string,
  from: string,
  to: string,
  now = new Date(),
): Promise<number> {
  const today = await orgDayOf(orgId, now);
  const last = to < today ? to : addDays(today, -1);
  if (from > last) return 0;
  const refreshFrom = addDays(today, -REFRESH_DAYS);
  const runs = await RollupRun.find({ orgId, day: { $gte: from, $lte: last } })
    .select('day computedAt')
    .lean();
  const computedAt = new Map(runs.map((r) => [r.day, r.computedAt.getTime()]));
  let computed = 0;
  for (let day = from; day <= last; day = addDays(day, 1)) {
    const at = computedAt.get(day);
    const stale = day >= refreshFrom && at !== undefined && now.getTime() - at > REFRESH_AFTER_MS;
    if (at === undefined || stale) {
      await rollupDay(orgId, day);
      computed += 1;
    }
  }
  return computed;
}

/** One pass over all organizations: the refresh window up to yesterday. */
export async function runAnalyticsRollup(now = new Date()): Promise<number> {
  // System job across organizations.
  const orgs = await Organization.find({}).select('_id').lean();
  let computed = 0;
  for (const org of orgs) {
    const orgId = idString(org._id);
    try {
      const today = await orgDayOf(orgId, now);
      computed += await ensureRollups(orgId, addDays(today, -REFRESH_DAYS), today, now);
    } catch (error) {
      logger.error({ err: error, orgId }, 'Analytics rollup failed');
    }
  }
  return computed;
}

export function startAnalyticsRollup(intervalSec = 600): () => void {
  const intervalMs = intervalSec * 1000;
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    getRedis()
      .set(LOCK_KEY, '1', 'PX', Math.max(1000, intervalMs - 250), 'NX')
      .then((acquired) => (acquired === 'OK' ? runAnalyticsRollup() : 0))
      .catch((error: unknown) => logger.error({ err: error }, 'Analytics rollup failed'))
      .finally(() => {
        running = false;
      });
  };
  const first = setTimeout(tick, 30_000);
  first.unref();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
