import { badRequest, notFound } from '../../lib/errors.js';
import { ANOMALY_TYPES, type AnomalyType } from '../../shared/enums.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import { addDays, daysBetween } from '../../shared/time.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile } from '../agents/agent.model.js';
import { orgDayOf } from '../organizations/settings-cache.js';
import { isTeamInScope, resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { User } from '../users/user.model.js';
import {
  MAX_RANGE_DAYS,
  type AnalyticsAgentDto,
  type AnalyticsDayDto,
  type AnalyticsQuery,
  type AnalyticsSummaryDto,
} from './analytics.schemas.js';
import { DailyAgentStats } from './daily-stats.model.js';
import { computeDayStats, ensureRollups, type DayStats } from './rollup.js';

const TODAY_CACHE_MS = 60_000;
const todayCache = new Map<string, { rows: DayStats[]; expiresAt: number }>();

async function todayRows(orgId: string, day: string): Promise<DayStats[]> {
  const key = `${orgId}:${day}`;
  const hit = todayCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.rows;
  const rows = await computeDayStats(orgId, day);
  todayCache.set(key, { rows, expiresAt: Date.now() + TODAY_CACHE_MS });
  return rows;
}

export interface StatsSelection {
  from: string;
  to: string;
  teamId: string | null;
  rows: DayStats[];
}

/**
 * Rows for the caller's scope and range: stored rollups for finished days (computed on demand if
 * missing) plus live numbers for today.
 */
export async function loadStats(actor: Actor, query: AnalyticsQuery): Promise<StatsSelection> {
  const today = await orgDayOf(actor.orgId);
  const to = query.to ?? today;
  const from = query.from ?? addDays(to, -6);
  if (from > to) throw badRequest('from must not be after to');
  if (daysBetween(from, to).length > MAX_RANGE_DAYS)
    throw badRequest(`The range may span at most ${MAX_RANGE_DAYS} days`);

  const scope = await resolveTeamScope(actor);
  if (query.teamId && !isTeamInScope(scope, query.teamId)) throw notFound('Team');
  const teamFilter = query.teamId ? { teamId: toObjectId(query.teamId) } : teamScopeFilter(scope);
  const inScope = (row: DayStats) =>
    query.teamId
      ? row.teamId !== null && idString(row.teamId) === query.teamId
      : isTeamInScope(scope, row.teamId);

  const lastStored = to < today ? to : addDays(today, -1);
  let rows: DayStats[] = [];
  if (from <= lastStored) {
    await ensureRollups(actor.orgId, from, lastStored);
    rows = await DailyAgentStats.find({
      orgId: actor.orgId,
      day: { $gte: from, $lte: lastStored },
      ...teamFilter,
    }).lean();
  }
  if (from <= today && today <= to) {
    rows = rows.concat((await todayRows(actor.orgId, today)).filter(inScope));
  }
  return { from, to, teamId: query.teamId ?? null, rows };
}

// ------------------------------------------------------------------ aggregation

interface Totals {
  agents: Set<string>;
  distanceM: number;
  shiftSec: number;
  visits: DayStats['visits'];
  assignments: DayStats['assignments'];
  anomalies: { total: number; high: number; byType: Record<string, number> };
}

function emptyTotals(): Totals {
  return {
    agents: new Set(),
    distanceM: 0,
    shiftSec: 0,
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
  };
}

/** An agent counts as active on a day with shift time, GPS, or visits. */
const isActive = (row: DayStats) =>
  row.shiftSec > 0 || row.sampleCount > 0 || row.visits.total > row.visits.missed;

function add(totals: Totals, row: DayStats): void {
  if (isActive(row)) totals.agents.add(idString(row.agentId));
  totals.distanceM += row.distanceM;
  totals.shiftSec += row.shiftSec;
  for (const key of Object.keys(totals.visits) as (keyof Totals['visits'])[])
    totals.visits[key] += row.visits[key];
  totals.assignments.total += row.assignments.total;
  totals.assignments.completed += row.assignments.completed;
  totals.anomalies.total += row.anomalies.total;
  totals.anomalies.high += row.anomalies.high;
  for (const [type, n] of Object.entries(row.anomalies.byType))
    totals.anomalies.byType[type] = (totals.anomalies.byType[type] ?? 0) + n;
}

const ratio = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 1000 : null;
const km = (meters: number) => Math.round(meters / 100) / 10;
const hours = (sec: number) => Math.round(sec / 360) / 10;

function derived(t: Totals) {
  const judged = t.visits.verified + t.visits.needsReview + t.visits.rejected;
  return {
    distanceKm: km(t.distanceM),
    shiftHours: hours(t.shiftSec),
    visits: {
      total: t.visits.total,
      verified: t.visits.verified,
      needsReview: t.visits.needsReview,
      rejected: t.visits.rejected,
      missed: t.visits.missed,
      inProgress: t.visits.inProgress,
    },
    verificationRate: ratio(t.visits.verified, judged),
    onTimeRate: ratio(t.visits.onTime, t.visits.onTime + t.visits.late),
  };
}

export async function getSummary(
  actor: Actor,
  query: AnalyticsQuery,
): Promise<AnalyticsSummaryDto> {
  const { from, to, teamId, rows } = await loadStats(actor, query);
  const totals = emptyTotals();
  for (const row of rows) add(totals, row);
  const byType = Object.fromEntries(
    ANOMALY_TYPES.map((type) => [type, totals.anomalies.byType[type] ?? 0]),
  ) as Record<AnomalyType, number>;
  return {
    from,
    to,
    teamId,
    agentsActive: totals.agents.size,
    ...derived(totals),
    avgDwellMin:
      totals.visits.dwellCount > 0
        ? Math.round(totals.visits.dwellSecTotal / totals.visits.dwellCount / 6) / 10
        : null,
    assignments: {
      total: totals.assignments.total,
      completed: totals.assignments.completed,
      completionRate: ratio(totals.assignments.completed, totals.assignments.total),
    },
    anomalies: { total: totals.anomalies.total, high: totals.anomalies.high, byType },
    generatedAt: new Date().toISOString(),
  };
}

export async function getDaily(actor: Actor, query: AnalyticsQuery): Promise<AnalyticsDayDto[]> {
  const { from, to, rows } = await loadStats(actor, query);
  const byDay = new Map(daysBetween(from, to).map((day) => [day, emptyTotals()]));
  for (const row of rows) {
    const totals = byDay.get(row.day);
    if (totals) add(totals, row);
  }
  return [...byDay.entries()].map(([day, t]) => ({
    day,
    agentsActive: t.agents.size,
    ...derived(t),
    assignmentsTotal: t.assignments.total,
    assignmentsCompleted: t.assignments.completed,
    anomalies: t.anomalies.total,
  }));
}

export async function getAgentScorecards(
  actor: Actor,
  query: AnalyticsQuery,
): Promise<AnalyticsAgentDto[]> {
  const { rows } = await loadStats(actor, query);
  const byAgent = new Map<string, { totals: Totals; days: number; teamId: string | null }>();
  for (const row of rows) {
    const key = idString(row.agentId);
    let entry = byAgent.get(key);
    if (!entry) {
      entry = { totals: emptyTotals(), days: 0, teamId: row.teamId ? idString(row.teamId) : null };
      byAgent.set(key, entry);
    }
    add(entry.totals, row);
    if (isActive(row)) entry.days += 1;
  }

  const profiles = await AgentProfile.find({
    orgId: actor.orgId,
    _id: { $in: [...byAgent.keys()] },
  })
    .select('userId')
    .lean();
  const users = await User.find({ orgId: actor.orgId, _id: { $in: profiles.map((p) => p.userId) } })
    .select('name')
    .lean();
  const userNames = new Map(users.map((u) => [idString(u._id), u.name]));
  const names = new Map(
    profiles.map((p) => [idString(p._id), userNames.get(idString(p.userId)) ?? 'Unknown agent']),
  );

  return [...byAgent.entries()]
    .map(([agentId, { totals, days, teamId }]) => ({
      agentId,
      name: names.get(agentId) ?? 'Unknown agent',
      teamId,
      daysActive: days,
      ...derived(totals),
      assignmentsTotal: totals.assignments.total,
      assignmentsCompleted: totals.assignments.completed,
      anomalies: totals.anomalies.total,
      highAnomalies: totals.anomalies.high,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
