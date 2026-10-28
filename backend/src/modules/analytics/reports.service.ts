import type { Types } from 'mongoose';
import type { Response } from 'express';
import { badRequest, notFound } from '../../lib/errors.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import { addDays, daysBetween, zonedDayBounds } from '../../shared/time.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile } from '../agents/agent.model.js';
import { Anomaly } from '../anomalies/anomaly.model.js';
import { recordAudit } from '../audit/audit.service.js';
import { ClientLocation } from '../locations/location.model.js';
import { getOrgTimezone, orgDayOf } from '../organizations/settings-cache.js';
import { Team } from '../teams/team.model.js';
import { isTeamInScope, resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { User } from '../users/user.model.js';
import { Visit } from '../visits/visit.model.js';
import { MAX_RANGE_DAYS, type AnalyticsQuery } from './analytics.schemas.js';
import { loadStats } from './analytics.service.js';
import { CsvWriter } from './csv.js';

export const REPORT_TYPES = ['visits', 'anomalies', 'agent-daily'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

async function rangeAndScope(actor: Actor, query: AnalyticsQuery) {
  const to = query.to ?? (await orgDayOf(actor.orgId));
  const from = query.from ?? addDays(to, -6);
  if (from > to) throw badRequest('from must not be after to');
  if (daysBetween(from, to).length > MAX_RANGE_DAYS)
    throw badRequest(`The range may span at most ${MAX_RANGE_DAYS} days`);
  const scope = await resolveTeamScope(actor);
  if (query.teamId && !isTeamInScope(scope, query.teamId)) throw notFound('Team');
  const teamFilter = query.teamId ? { teamId: toObjectId(query.teamId) } : teamScopeFilter(scope);
  return { from, to, teamFilter };
}

/** Names for ids that appear in reports (org-sized lookups, loaded once per export). */
async function directory(orgId: string) {
  const [profiles, teams, locations] = await Promise.all([
    AgentProfile.find({ orgId }).select('userId employeeCode').lean(),
    Team.find({ orgId }).select('name').lean(),
    ClientLocation.find({ orgId }).select('name').lean(),
  ]);
  const users = await User.find({ orgId, _id: { $in: profiles.map((p) => p.userId) } })
    .select('name')
    .lean();
  const userNames = new Map(users.map((u) => [idString(u._id), u.name]));
  return {
    agent: new Map(
      profiles.map((p) => [
        idString(p._id),
        { name: userNames.get(idString(p.userId)) ?? '', code: p.employeeCode ?? '' },
      ]),
    ),
    team: new Map(teams.map((t) => [idString(t._id), t.name])),
    location: new Map(locations.map((l) => [idString(l._id), l.name])),
  };
}

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);
const minutes = (sec: number | null | undefined) =>
  sec === null || sec === undefined ? null : Math.round(sec / 6) / 10;

/** Streams a CSV report. Scoped like the dashboards and recorded in the audit log. */
export async function exportReport(
  actor: Actor,
  type: ReportType,
  query: AnalyticsQuery,
  res: Response,
): Promise<void> {
  const { from, to, teamFilter } = await rangeAndScope(actor, query);
  const names = await directory(actor.orgId);
  const agentName = (id: Types.ObjectId) => names.agent.get(idString(id))?.name ?? '';
  const agentCode = (id: Types.ObjectId) => names.agent.get(idString(id))?.code ?? '';
  const teamName = (id: Types.ObjectId | null) => (id ? (names.team.get(idString(id)) ?? '') : '');
  const csv = new CsvWriter(res);
  const filename = `fieldtrace-${type}-${from}-to-${to}.csv`;
  let rows = 0;

  if (type === 'visits') {
    csv.start(filename, [
      'visit_date',
      'agent',
      'employee_code',
      'team',
      'location',
      'status',
      'method',
      'check_in_at',
      'check_out_at',
      'duration_min',
      'on_time',
      'delay_min',
      'gps_samples',
      'avg_accuracy_m',
      'mock_location',
      'review_reasons',
      'review_decision',
      'review_note',
      'visit_id',
    ]);
    const cursor = Visit.find({
      orgId: actor.orgId,
      visitDate: { $gte: from, $lte: to },
      ...teamFilter,
    })
      .sort({ visitDate: 1, checkInAt: 1, _id: 1 })
      .lean()
      .cursor();
    for await (const v of cursor) {
      if (!csv.open) break;
      await csv.row([
        v.visitDate,
        agentName(v.agentId),
        agentCode(v.agentId),
        teamName(v.teamId),
        names.location.get(idString(v.locationId)) ?? '',
        v.status,
        v.method,
        iso(v.checkInAt),
        iso(v.checkOutAt),
        minutes(v.durationSec),
        v.arrival ? v.arrival.onTime : null,
        v.arrival ? minutes(Math.max(0, v.arrival.delaySec)) : null,
        v.signals.sampleCount,
        v.signals.avgAccuracyM === null ? null : Math.round(v.signals.avgAccuracyM),
        v.signals.mockLocation,
        v.reviewReasons.join(' '),
        v.review?.decision ?? null,
        v.review?.note ?? null,
        idString(v._id),
      ]);
      rows += 1;
    }
  } else if (type === 'anomalies') {
    const timeZone = await getOrgTimezone(actor.orgId);
    const start = zonedDayBounds(from, timeZone).start;
    const end = zonedDayBounds(to, timeZone).end;
    csv.start(filename, [
      'first_seen_at',
      'last_seen_at',
      'agent',
      'employee_code',
      'team',
      'type',
      'severity',
      'status',
      'title',
      'explanation',
      'occurrences',
      'lat',
      'lng',
      'location',
      'resolution_note',
      'anomaly_id',
    ]);
    const cursor = Anomaly.find({
      orgId: actor.orgId,
      firstSeenAt: { $gte: start, $lt: end },
      ...teamFilter,
    })
      .sort({ firstSeenAt: 1, _id: 1 })
      .lean()
      .cursor();
    for await (const a of cursor) {
      if (!csv.open) break;
      await csv.row([
        iso(a.firstSeenAt),
        iso(a.lastSeenAt),
        agentName(a.agentId),
        agentCode(a.agentId),
        teamName(a.teamId),
        a.type,
        a.severity,
        a.status,
        a.title,
        a.explanation,
        a.occurrences,
        a.position?.lat ?? null,
        a.position?.lng ?? null,
        a.locationId ? (names.location.get(idString(a.locationId)) ?? '') : null,
        a.resolution?.note ?? null,
        idString(a._id),
      ]);
      rows += 1;
    }
  } else {
    const { rows: stats } = await loadStats(actor, { from, to, teamId: query.teamId });
    csv.start(filename, [
      'day',
      'agent',
      'employee_code',
      'team',
      'distance_km',
      'shift_hours',
      'gps_samples',
      'visits',
      'verified',
      'needs_review',
      'rejected',
      'missed',
      'on_time',
      'late',
      'avg_dwell_min',
      'assignments',
      'assignments_completed',
      'anomalies',
      'high_anomalies',
    ]);
    stats.sort(
      (a, b) =>
        a.day.localeCompare(b.day) || agentName(a.agentId).localeCompare(agentName(b.agentId)),
    );
    for (const s of stats) {
      if (!csv.open) break;
      await csv.row([
        s.day,
        agentName(s.agentId),
        agentCode(s.agentId),
        teamName(s.teamId),
        Math.round(s.distanceM / 100) / 10,
        Math.round(s.shiftSec / 360) / 10,
        s.sampleCount,
        s.visits.total,
        s.visits.verified,
        s.visits.needsReview,
        s.visits.rejected,
        s.visits.missed,
        s.visits.onTime,
        s.visits.late,
        s.visits.dwellCount > 0 ? minutes(s.visits.dwellSecTotal / s.visits.dwellCount) : null,
        s.assignments.total,
        s.assignments.completed,
        s.anomalies.total,
        s.anomalies.high,
      ]);
      rows += 1;
    }
  }
  // Audit before closing the response, so a finished download always has its audit entry.
  await recordAudit(actor, {
    action: 'report.exported',
    entityType: 'organization',
    entityId: actor.orgId,
    metadata: { report: type, from, to, teamId: query.teamId ?? null, rows },
  });
  csv.end();
}
