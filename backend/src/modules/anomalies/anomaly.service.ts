import type { Types } from 'mongoose';
import { invalidTransition, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { pageMeta, skipFor, toMongoSort } from '../../lib/pagination.js';
import { publishAnomaly } from '../../realtime/publisher.js';
import {
  ANOMALY_STATUSES,
  ANOMALY_TYPES,
  SEVERITIES,
  type ShiftStatus,
} from '../../shared/enums.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile } from '../agents/agent.model.js';
import { recordAudit } from '../audit/audit.service.js';
import { anomalyRulesOf } from '../organizations/organization.model.js';
import { getOrgSettings, getOrgTimezone } from '../organizations/settings-cache.js';
import { isTeamInScope, resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { getLatestFixes, type LiveFix } from '../tracking/live-state.js';
import { User } from '../users/user.model.js';
import { findContaining, getOrgGeofences } from '../visits/geofence-index.js';
import type { VisitDoc } from '../visits/visit.model.js';
import { Anomaly, type AnomalyDoc } from './anomaly.model.js';
import type {
  AnomalyDto,
  AnomalyStatsDto,
  ListAnomaliesQuery,
  UpdateAnomalyStatusBody,
} from './anomaly.schemas.js';
import {
  detectLongUnplannedStop,
  detectMockLocation,
  detectMotionAnomalies,
  detectOffHours,
  detectSignalGap,
  type Finding,
  type RuleFix,
} from './detectors.js';

interface AgentRef {
  _id: Types.ObjectId;
  teamId: Types.ObjectId | null;
}

// ------------------------------------------------------------------ DTO

export async function toAnomalyDtos(orgId: string, docs: AnomalyDoc[]): Promise<AnomalyDto[]> {
  const agentIds = [...new Set(docs.map((d) => idString(d.agentId)))];
  const profiles = await AgentProfile.find({ orgId, _id: { $in: agentIds } })
    .select('userId')
    .lean();
  const userIds = new Set<string>(profiles.map((p) => idString(p.userId)));
  for (const doc of docs) {
    if (doc.acknowledged) userIds.add(idString(doc.acknowledged.by));
    if (doc.resolution) userIds.add(idString(doc.resolution.by));
  }
  const users = await User.find({ orgId, _id: { $in: [...userIds] } })
    .select('name')
    .lean();
  const names = new Map(users.map((u) => [idString(u._id), u.name]));
  const agentNames = new Map(
    profiles.map((p) => [idString(p._id), names.get(idString(p.userId)) ?? 'Unknown agent']),
  );
  const userRef = (id: Types.ObjectId) => ({
    id: idString(id),
    name: names.get(idString(id)) ?? 'Unknown user',
  });

  return docs.map((doc) => ({
    id: idString(doc._id),
    agentId: idString(doc.agentId),
    agent: agentNames.has(idString(doc.agentId))
      ? { id: idString(doc.agentId), name: agentNames.get(idString(doc.agentId))! }
      : null,
    teamId: doc.teamId ? idString(doc.teamId) : null,
    sessionId: doc.sessionId ? idString(doc.sessionId) : null,
    type: doc.type,
    severity: doc.severity,
    status: doc.status,
    title: doc.title,
    explanation: doc.explanation,
    metrics: { ...doc.metrics },
    position: doc.position ? { lat: doc.position.lat, lng: doc.position.lng } : null,
    locationId: doc.locationId ? idString(doc.locationId) : null,
    visitId: doc.visitId ? idString(doc.visitId) : null,
    firstSeenAt: doc.firstSeenAt.toISOString(),
    lastSeenAt: doc.lastSeenAt.toISOString(),
    occurrences: doc.occurrences,
    acknowledged: doc.acknowledged
      ? { by: userRef(doc.acknowledged.by), at: doc.acknowledged.at.toISOString() }
      : null,
    resolution: doc.resolution
      ? {
          by: userRef(doc.resolution.by),
          at: doc.resolution.at.toISOString(),
          status: doc.resolution.status,
          note: doc.resolution.note,
        }
      : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

async function publish(
  orgId: string,
  doc: AnomalyDoc,
  kind: 'created' | 'updated',
): Promise<AnomalyDto> {
  const [dto] = await toAnomalyDtos(orgId, [doc]);
  publishAnomaly(orgId, kind, dto!);
  return dto!;
}

// ------------------------------------------------------------------ raising

/**
 * Records a finding. While an anomaly with the same `dedupeKey` is still active the finding is
 * merged into it (newest numbers; `merge` findings also bump `occurrences` and are re-published).
 * Returns the stored document, or null if nothing changed.
 */
export async function raiseAnomaly(
  orgId: string,
  agent: AgentRef,
  sessionId: string | null,
  finding: Finding,
): Promise<AnomalyDoc | null> {
  const lastAt = finding.lastAt ?? finding.at;
  const filter = { orgId: toObjectId(orgId), dedupeKey: finding.dedupeKey, isActive: true };
  const mergeUpdate = {
    $max: { lastSeenAt: lastAt },
    $set: {
      metrics: finding.metrics,
      explanation: finding.explanation,
      severity: finding.severity,
      ...(finding.position ? { position: finding.position } : {}),
    },
    ...(finding.mode === 'merge' ? { $inc: { occurrences: 1 } } : {}),
  };

  const merge = async () => {
    const merged = await Anomaly.findOneAndUpdate(filter, mergeUpdate, {
      returnDocument: 'after',
    }).lean();
    if (merged && finding.mode === 'merge') await publish(orgId, merged, 'updated');
    return merged;
  };

  const existing = await merge();
  if (existing) return existing;

  try {
    const created = (
      await Anomaly.create({
        orgId,
        agentId: agent._id,
        teamId: agent.teamId,
        sessionId,
        type: finding.type,
        severity: finding.severity,
        status: 'open',
        isActive: true,
        dedupeKey: finding.dedupeKey,
        title: finding.title,
        explanation: finding.explanation,
        metrics: finding.metrics,
        position: finding.position,
        locationId: finding.locationId ?? null,
        visitId: finding.visitId ?? null,
        firstSeenAt: finding.at,
        lastSeenAt: lastAt,
        occurrences: 1,
      })
    ).toObject();
    await publish(orgId, created, 'created');
    return created;
  } catch (error) {
    // Another request created it first (unique active key): merge into that one instead.
    if ((error as { code?: number }).code !== 11000) throw error;
    return merge();
  }
}

/**
 * Runs the per-fix rules over an agent's new GPS fixes (called from telemetry ingestion with the
 * live fix that preceded the batch). Never throws: anomalies must not reject telemetry.
 */
export async function processTelemetryAnomalies(
  orgId: string,
  agent: AgentRef,
  sessionId: string,
  previous: LiveFix | null,
  samples: RuleFix[],
): Promise<void> {
  if (samples.length === 0) return;
  try {
    const agentId = idString(agent._id);
    const [settings, timeZone] = await Promise.all([getOrgSettings(orgId), getOrgTimezone(orgId)]);
    const rules = anomalyRulesOf(settings);
    const prevFix: RuleFix | null = previous
      ? {
          lat: previous.lat,
          lng: previous.lng,
          accuracyM: previous.accuracyM,
          recordedAtMs: previous.recordedAt,
          isMock: previous.flags.includes('mock_location'),
        }
      : null;
    const findings = [
      ...detectMotionAnomalies(agentId, prevFix, samples, rules),
      detectMockLocation(agentId, samples, rules.mockLocation),
      detectOffHours(agentId, samples, timeZone, settings.workingHours, rules.offHours),
    ].filter((finding): finding is Finding => finding !== null);
    for (const finding of findings) await raiseAnomaly(orgId, agent, sessionId, finding);
  } catch (error) {
    logger.error({ err: error, agentId: idString(agent._id) }, 'Anomaly detection failed');
  }
}

/** Visits that need review or were missed become `visit_issue` anomalies (one per visit). */
export async function raiseVisitIssue(orgId: string, visit: VisitDoc): Promise<void> {
  if (visit.status !== 'needs_review' && visit.status !== 'missed') return;
  try {
    const rules = anomalyRulesOf(await getOrgSettings(orgId));
    if (!rules.visitIssues.enabled) return;
    const reasons = visit.reviewReasons;
    const missed = visit.status === 'missed';
    const severity = missed
      ? 'medium'
      : reasons.includes('mock_location')
        ? 'high'
        : reasons.some((r) =>
              ['signal_lost', 'no_gps_presence', 'checkin_outside_geofence'].includes(r),
            )
          ? 'medium'
          : 'low';
    const entry = visit.evidence[0];
    await raiseAnomaly(
      orgId,
      { _id: visit.agentId, teamId: visit.teamId },
      visit.sessionId ? idString(visit.sessionId) : null,
      {
        type: 'visit_issue',
        severity,
        dedupeKey: `visit:${idString(visit._id)}`,
        mode: 'once',
        title: missed ? 'Planned visit missed' : 'Visit needs review',
        explanation: missed
          ? `The stop planned for ${visit.visitDate} was never visited.`
          : `The visit could not be verified automatically: ${reasons
              .map((r) => r.replaceAll('_', ' '))
              .join(', ')}.`,
        metrics: {
          visitStatus: visit.status,
          reasons: reasons.join(',') || null,
          durationSec: visit.durationSec,
          avgAccuracyM: visit.signals.avgAccuracyM,
          visitDate: visit.visitDate,
        },
        at: visit.checkOutAt ?? visit.checkInAt ?? new Date(),
        position: entry ? { lat: entry.lat, lng: entry.lng } : null,
        locationId: idString(visit.locationId),
        visitId: idString(visit._id),
      },
    );
  } catch (error) {
    logger.error({ err: error, visitId: idString(visit._id) }, 'Visit anomaly failed');
  }
}

/** A reviewer's decision on a visit also settles its `visit_issue` anomaly. */
export async function settleVisitIssue(
  actor: Actor,
  visitId: Types.ObjectId,
  decision: 'verified' | 'rejected',
): Promise<void> {
  const updated = await Anomaly.findOneAndUpdate(
    { orgId: actor.orgId, dedupeKey: `visit:${idString(visitId)}`, isActive: true },
    {
      $set: {
        status: 'resolved',
        isActive: false,
        resolution: {
          by: toObjectId(actor.userId),
          at: new Date(),
          status: 'resolved',
          note: `Visit ${decision} by reviewer`,
        },
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (updated) await publish(actor.orgId, updated, 'updated');
}

export interface SweepAgent {
  agentId: string;
  teamId: string | null;
  shiftStatus: ShiftStatus;
  /** Newest fix time, or null if none yet this shift. */
  lastSeen: number | null;
}

/**
 * Time-based rules evaluated by the status sweep for agents on an active shift: signal gaps and
 * long stops outside client sites. Agents on break are skipped.
 */
export async function sweepAgentAnomalies(
  orgId: string,
  agents: SweepAgent[],
  nowMs = Date.now(),
): Promise<number> {
  const onShift = agents.filter((a) => a.shiftStatus === 'on_shift' && a.lastSeen !== null);
  if (onShift.length === 0) return 0;
  const rules = anomalyRulesOf(await getOrgSettings(orgId));
  if (!rules.signalGap.enabled && !rules.longUnplannedStop.enabled) return 0;
  const [fixes, fences] = await Promise.all([
    getLatestFixes(
      orgId,
      onShift.map((a) => a.agentId),
    ),
    getOrgGeofences(orgId),
  ]);

  let raised = 0;
  for (const agent of onShift) {
    const fix = fixes.get(agent.agentId) ?? null;
    const position = fix ? { lat: fix.lat, lng: fix.lng } : null;
    const findings: (Finding | null)[] = [
      detectSignalGap(agent.agentId, agent.lastSeen!, nowMs, position, rules.signalGap),
    ];
    if (fix?.stationarySince && position && !findContaining(fences, position)) {
      findings.push(
        detectLongUnplannedStop(
          agent.agentId,
          { position, stationarySinceMs: fix.stationarySince },
          nowMs,
          rules.longUnplannedStop,
        ),
      );
    }
    const ref = {
      _id: toObjectId(agent.agentId),
      teamId: agent.teamId ? toObjectId(agent.teamId) : null,
    };
    for (const finding of findings) {
      if (!finding) continue;
      try {
        if (await raiseAnomaly(orgId, ref, fix?.sessionId ?? null, finding)) raised += 1;
      } catch (error) {
        logger.error({ err: error, agentId: agent.agentId }, 'Anomaly sweep failed');
      }
    }
  }
  return raised;
}

// ------------------------------------------------------------------ dashboard

async function findInScope(actor: Actor, id: string): Promise<AnomalyDoc> {
  const doc = await Anomaly.findOne({ _id: id, orgId: actor.orgId }).lean();
  if (!doc || !isTeamInScope(await resolveTeamScope(actor), doc.teamId)) throw notFound('Anomaly');
  return doc;
}

export async function listAnomalies(actor: Actor, query: ListAnomaliesQuery) {
  const scope = await resolveTeamScope(actor);
  const conditions: Record<string, unknown>[] = [teamScopeFilter(scope)];
  if (query.status) conditions.push({ status: { $in: query.status } });
  if (query.type) conditions.push({ type: { $in: query.type } });
  if (query.severity) conditions.push({ severity: { $in: query.severity } });
  if (query.agentId) conditions.push({ agentId: toObjectId(query.agentId) });
  if (query.teamId) conditions.push({ teamId: toObjectId(query.teamId) });
  if (query.from) conditions.push({ lastSeenAt: { $gte: new Date(query.from) } });
  if (query.to) conditions.push({ firstSeenAt: { $lte: new Date(query.to) } });
  const filter = { orgId: toObjectId(actor.orgId), $and: conditions };
  const [docs, total] = await Promise.all([
    Anomaly.find(filter)
      .sort(toMongoSort(query.sort))
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    Anomaly.countDocuments(filter),
  ]);
  return {
    data: await toAnomalyDtos(actor.orgId, docs),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function getAnomaly(actor: Actor, id: string): Promise<AnomalyDto> {
  return (await toAnomalyDtos(actor.orgId, [await findInScope(actor, id)]))[0]!;
}

/** Counts for badges: active anomalies by type/severity, everything by status. */
export async function anomalyStats(actor: Actor): Promise<AnomalyStatsDto> {
  const scope = await resolveTeamScope(actor);
  const match = { orgId: toObjectId(actor.orgId), ...teamScopeFilter(scope) };
  const [byStatus, active] = await Promise.all([
    Anomaly.aggregate<{ _id: string; n: number }>([
      { $match: match },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    Anomaly.aggregate<{ _id: { type: string; severity: string }; n: number }>([
      { $match: { ...match, isActive: true } },
      { $group: { _id: { type: '$type', severity: '$severity' }, n: { $sum: 1 } } },
    ]),
  ]);
  const zero = <T extends readonly string[]>(keys: T) =>
    Object.fromEntries(keys.map((k) => [k, 0])) as Record<T[number], number>;
  const stats: AnomalyStatsDto = {
    active: 0,
    byStatus: zero(ANOMALY_STATUSES),
    activeByType: zero(ANOMALY_TYPES),
    activeBySeverity: zero(SEVERITIES),
  };
  for (const row of byStatus) stats.byStatus[row._id as keyof typeof stats.byStatus] = row.n;
  for (const row of active) {
    stats.active += row.n;
    stats.activeByType[row._id.type as keyof typeof stats.activeByType] += row.n;
    stats.activeBySeverity[row._id.severity as keyof typeof stats.activeBySeverity] += row.n;
  }
  return stats;
}

/**
 * Manager workflow: `open → acknowledged`, and `open|acknowledged → resolved|dismissed`.
 * Final states release the dedupe key, so a repeat of the signal opens a fresh record. Audited.
 */
export async function updateAnomalyStatus(
  actor: Actor,
  id: string,
  body: UpdateAnomalyStatusBody,
): Promise<AnomalyDto> {
  const doc = await findInScope(actor, id);
  const allowedFrom = body.status === 'acknowledged' ? ['open'] : ['open', 'acknowledged'];
  if (!allowedFrom.includes(doc.status)) {
    throw invalidTransition(`Cannot change an anomaly from ${doc.status} to ${body.status}`);
  }
  const now = new Date();
  const by = toObjectId(actor.userId);
  const set =
    body.status === 'acknowledged'
      ? { status: 'acknowledged', acknowledged: { by, at: now } }
      : {
          status: body.status,
          isActive: false,
          resolution: { by, at: now, status: body.status, note: body.note ?? null },
        };
  const updated = await Anomaly.findOneAndUpdate(
    { _id: doc._id, orgId: actor.orgId, status: doc.status },
    { $set: set },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw invalidTransition('The anomaly was changed by someone else; reload it');

  await recordAudit(actor, {
    action: `anomaly.${body.status}`,
    entityType: 'anomaly',
    entityId: doc._id,
    changes: { status: { from: doc.status, to: body.status } },
    metadata: { type: doc.type, note: body.note ?? null },
  });
  return publish(actor.orgId, updated, 'updated');
}
