import { getRedis } from '../../lib/redis.js';

/**
 * Which geofence an agent is currently inside, plus the GPS quality collected while inside.
 * Stored in Redis (`org:{orgId}:presence`, field = agentId) so it survives restarts and is
 * shared across instances. MongoDB keeps the durable record (GeofenceEvent / Visit).
 */
export interface Presence {
  locationId: string;
  sessionId: string | null;
  /** Epoch ms of the entry fix. */
  enteredAt: number;
  lastInsideAt: number;
  /** Epoch ms of the first fix clearly outside (exit is confirmed after a debounce). */
  outsideSince: number | null;
  /** Visit opened for this stay (after the minimum dwell, or by a manual check-in). */
  visitId: string | null;
  /** True when no visit could be opened (agent had another open visit) — do not retry per fix. */
  visitSkipped?: boolean;
  sampleCount: number;
  accuracySum: number;
  maxAccuracyM: number;
  mock: boolean;
  /** Last fix inside the geofence. */
  lastFix: { lat: number; lng: number; accuracyM: number | null };
  /** First fix clearly outside (the exit position), set together with `outsideSince`. */
  exitFix?: { lat: number; lng: number; accuracyM: number | null } | null;
}

const presenceKey = (orgId: string) => `org:${orgId}:presence`;

export async function getPresence(orgId: string, agentId: string): Promise<Presence | null> {
  const value = await getRedis().hget(presenceKey(orgId), agentId);
  return value ? (JSON.parse(value) as Presence) : null;
}

export async function savePresence(
  orgId: string,
  agentId: string,
  presence: Presence | null,
): Promise<void> {
  if (presence) await getRedis().hset(presenceKey(orgId), agentId, JSON.stringify(presence));
  else await getRedis().hdel(presenceKey(orgId), agentId);
}

export async function listPresences(orgId: string): Promise<Map<string, Presence>> {
  const all = await getRedis().hgetall(presenceKey(orgId));
  return new Map(
    Object.entries(all).map(([agentId, json]) => [agentId, JSON.parse(json) as Presence]),
  );
}

/** Aggregated GPS quality signals for a visit, from the presence data. */
export function signalsFrom(presence: Presence | null) {
  if (!presence || presence.sampleCount === 0) {
    return {
      sampleCount: 0,
      avgAccuracyM: null,
      maxAccuracyM: null,
      mockLocation: presence?.mock ?? false,
    };
  }
  return {
    sampleCount: presence.sampleCount,
    avgAccuracyM: Math.round((presence.accuracySum / presence.sampleCount) * 10) / 10,
    maxAccuracyM: presence.maxAccuracyM,
    mockLocation: presence.mock,
  };
}
