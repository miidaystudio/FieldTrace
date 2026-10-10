import { logger } from '../../lib/logger.js';
import { getRedis } from '../../lib/redis.js';
import { publishAgentStatus } from '../../realtime/publisher.js';
import { idString } from '../../shared/schemas.js';
import { AgentProfile } from '../agents/agent.model.js';
import { getOrgSettings } from '../organizations/settings-cache.js';
import { computeConnectivity, getConnectivityStates, getLastSeen, liveKeys } from './live-state.js';
import { TrackingSession } from './tracking-session.model.js';

const LOCK_KEY = 'lock:status-sweep';

/**
 * Re-evaluates connectivity (online → stale → offline) for every agent on an active shift and
 * publishes `agent:status` for each change. A Redis lock ensures only one instance sweeps at a
 * time. Returns the number of status changes published.
 */
export async function runStatusSweep(nowMs = Date.now()): Promise<number> {
  // System job spanning all organizations: explicit opt-out of the tenancy guard.
  const sessions = await TrackingSession.find({ isActive: true })
    .select('orgId agentId')
    .setOptions({ skipTenantCheck: true })
    .lean();

  const byOrg = new Map<string, string[]>();
  for (const session of sessions) {
    const orgId = idString(session.orgId);
    byOrg.set(orgId, [...(byOrg.get(orgId) ?? []), idString(session.agentId)]);
  }

  let changes = 0;
  for (const [orgId, agentIds] of byOrg) {
    const [settings, lastSeen, stored, profiles] = await Promise.all([
      getOrgSettings(orgId),
      getLastSeen(orgId, agentIds),
      getConnectivityStates(orgId, agentIds),
      AgentProfile.find({ orgId, _id: { $in: agentIds } })
        .select('teamId shiftStatus')
        .lean(),
    ]);
    const profileById = new Map(profiles.map((p) => [idString(p._id), p]));

    const updates: string[] = [];
    agentIds.forEach((agentId, index) => {
      const profile = profileById.get(agentId);
      if (!profile) return;
      const seen = lastSeen[index] ?? null;
      const connectivity = computeConnectivity(profile.shiftStatus, seen, nowMs, settings);
      if (stored[index] === connectivity) return;
      updates.push(agentId, connectivity);
      changes += 1;
      publishAgentStatus(orgId, {
        agentId,
        teamId: profile.teamId ? idString(profile.teamId) : null,
        shiftStatus: profile.shiftStatus,
        connectivity,
        lastSeenAt: seen === null ? null : new Date(seen).toISOString(),
      });
    });
    if (updates.length > 0) await getRedis().hset(liveKeys.connectivity(orgId), ...updates);
  }
  return changes;
}

export function startStatusSweeper(intervalSec: number): () => void {
  const intervalMs = intervalSec * 1000;
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    getRedis()
      .set(LOCK_KEY, '1', 'PX', Math.max(1000, intervalMs - 250), 'NX')
      .then((acquired) => (acquired === 'OK' ? runStatusSweep() : 0))
      .catch((error: unknown) => logger.error({ err: error }, 'Status sweep failed'))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
