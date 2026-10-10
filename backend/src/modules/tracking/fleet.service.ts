import { badRequest } from '../../lib/errors.js';
import { haversineMeters } from '../../shared/geo.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile } from '../agents/agent.model.js';
import { findAgentInScope } from '../agents/agent.service.js';
import { getOrgSettings } from '../organizations/settings-cache.js';
import { resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { User } from '../users/user.model.js';
import { computeConnectivity, getLatestFixes, motionOf } from './live-state.js';
import { LocationTelemetry } from './telemetry.model.js';
import {
  DEFAULT_TRACK_WINDOW_MS,
  MAX_TRACK_WINDOW_MS,
  type FleetLiveQuery,
  type LiveAgentDto,
  type TrackDto,
  type TrackQuery,
} from './tracking.schemas.js';

/**
 * Snapshot for the live map: every active agent in the caller's scope with its latest fix
 * (from Redis) and connectivity computed now. Clients load this once, then apply
 * `location:update` / `agent:status` events; reload it after a socket reconnect.
 */
export async function getFleetLive(actor: Actor, query: FleetLiveQuery) {
  const now = Date.now();
  const scope = await resolveTeamScope(actor);
  const conditions: Record<string, unknown>[] = [teamScopeFilter(scope)];
  if (query.teamId) conditions.push({ teamId: toObjectId(query.teamId) });
  if (query.shiftStatus) conditions.push({ shiftStatus: { $in: query.shiftStatus } });

  const profiles = await AgentProfile.find({ orgId: actor.orgId, $and: conditions })
    .select('userId teamId employeeCode vehicle shiftStatus lastSeenAt')
    .lean();
  const users = await User.find({
    orgId: actor.orgId,
    _id: { $in: profiles.map((p) => p.userId) },
    status: 'active',
  })
    .select('name')
    .lean();
  const names = new Map(users.map((u) => [idString(u._id), u.name]));
  const active = profiles.filter((p) => names.has(idString(p.userId)));

  const [settings, fixes] = await Promise.all([
    getOrgSettings(actor.orgId),
    getLatestFixes(
      actor.orgId,
      active.map((p) => idString(p._id)),
    ),
  ]);

  const agents: LiveAgentDto[] = active.map((profile) => {
    const agentId = idString(profile._id);
    const fix = fixes.get(agentId) ?? null;
    const lastSeenMs = fix?.recordedAt ?? profile.lastSeenAt?.getTime() ?? null;
    return {
      agentId,
      name: names.get(idString(profile.userId))!,
      teamId: profile.teamId ? idString(profile.teamId) : null,
      employeeCode: profile.employeeCode,
      vehicle: { type: profile.vehicle.type, plate: profile.vehicle.plate },
      shiftStatus: profile.shiftStatus,
      connectivity: computeConnectivity(profile.shiftStatus, lastSeenMs, now, settings),
      motion: fix ? motionOf(fix) : null,
      position: fix ? { lat: fix.lat, lng: fix.lng } : null,
      accuracyM: fix?.accuracyM ?? null,
      speedMps: fix?.speedMps ?? null,
      headingDeg: fix?.headingDeg ?? null,
      batteryPct: fix?.batteryPct ?? null,
      flags: fix?.flags ?? [],
      recordedAt: fix ? new Date(fix.recordedAt).toISOString() : null,
      lastSeenAt: lastSeenMs === null ? null : new Date(lastSeenMs).toISOString(),
    };
  });

  const filtered = query.connectivity
    ? agents.filter((agent) => query.connectivity!.includes(agent.connectivity))
    : agents;
  filtered.sort((a, b) => a.name.localeCompare(b.name));
  return { agents: filtered, asOf: new Date(now).toISOString() };
}

/** Ordered raw GPS points of one agent for a time window (max 24 h). Phase 3 adds stops/gaps. */
export async function getAgentTrack(
  actor: Actor,
  agentId: string,
  query: TrackQuery,
): Promise<TrackDto> {
  const profile = await findAgentInScope(actor, agentId);

  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_TRACK_WINDOW_MS);
  if (from >= to) throw badRequest('from must be before to');
  if (to.getTime() - from.getTime() > MAX_TRACK_WINDOW_MS) {
    throw badRequest('The time window may span at most 24 hours');
  }

  const docs = await LocationTelemetry.find({
    'meta.orgId': toObjectId(actor.orgId),
    'meta.agentId': profile._id,
    recordedAt: { $gte: from, $lte: to },
  })
    .sort({ recordedAt: 1 })
    .limit(query.limit + 1)
    .select('lat lng accuracyM speedMps headingDeg recordedAt flags')
    .lean();

  const truncated = docs.length > query.limit;
  const page = truncated ? docs.slice(0, query.limit) : docs;
  let distanceM = 0;
  for (let i = 1; i < page.length; i++) distanceM += haversineMeters(page[i - 1]!, page[i]!);

  return {
    agentId: idString(profile._id),
    from: from.toISOString(),
    to: to.toISOString(),
    points: page.map((doc) => ({
      lat: doc.lat,
      lng: doc.lng,
      accuracyM: doc.accuracyM,
      speedMps: doc.speedMps,
      headingDeg: doc.headingDeg,
      recordedAt: doc.recordedAt.toISOString(),
      flags: doc.flags,
    })),
    pointCount: page.length,
    truncated,
    nextFrom: truncated ? docs[query.limit]!.recordedAt.toISOString() : null,
    distanceM: Math.round(distanceM),
  };
}
