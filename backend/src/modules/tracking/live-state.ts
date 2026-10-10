import { getRedis } from '../../lib/redis.js';
import { haversineMeters } from '../../shared/geo.js';
import type {
  ConnectivityStatus,
  MotionStatus,
  ShiftStatus,
  TelemetryFlag,
} from '../../shared/enums.js';

/**
 * Real-time state in Redis (all keys get REDIS_KEY_PREFIX from the client):
 *
 *   org:{orgId}:lastseen   ZSET  agentId -> recordedAt (ms) of newest fix   (ordering guard)
 *   org:{orgId}:latest     HASH  agentId -> JSON LiveFix                     (live map)
 *   org:{orgId}:geo        GEO   agentId -> lng/lat                          (proximity, Phase 3)
 *   org:{orgId}:conn       HASH  agentId -> last published connectivity      (change detection)
 *   dedupe:{sessionId}:{seq}  STRING, 24 h TTL                                (idempotent ingest)
 *
 * MongoDB time-series remains the source of truth for history; this is a cache of "now".
 */
export const liveKeys = {
  lastSeen: (orgId: string) => `org:${orgId}:lastseen`,
  latest: (orgId: string) => `org:${orgId}:latest`,
  geo: (orgId: string) => `org:${orgId}:geo`,
  connectivity: (orgId: string) => `org:${orgId}:conn`,
  dedupe: (sessionId: string, seq: number) => `dedupe:${sessionId}:${seq}`,
};

export const DEDUPE_TTL_SEC = 86_400;
/** At or above this speed (m/s ≈ 5.4 km/h) an agent counts as moving. */
export const MOVING_SPEED_MPS = 1.5;
/** Stationary for at least this long -> `stopped` instead of `idle`. */
export const STOPPED_AFTER_MS = 5 * 60_000;
const MIN_DISPLACEMENT_M = 25;

export interface LiveFix {
  agentId: string;
  teamId: string | null;
  sessionId: string;
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps: number | null;
  headingDeg: number | null;
  batteryPct: number | null;
  flags: TelemetryFlag[];
  /** Epoch ms. */
  recordedAt: number;
  receivedAt: number;
  /** Epoch ms since the agent has been stationary, or null while moving. */
  stationarySince: number | null;
}

/** Atomically stores a fix only if it is newer than the one already stored (out-of-order safe). */
const SAVE_IF_NEWER = `
local prev = redis.call('ZSCORE', KEYS[1], ARGV[1])
if prev and tonumber(prev) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
redis.call('GEOADD', KEYS[3], ARGV[4], ARGV[5], ARGV[1])
return 1
`;

export async function saveLatestIfNewer(orgId: string, fix: LiveFix): Promise<boolean> {
  const result = await getRedis().eval(
    SAVE_IF_NEWER,
    3,
    liveKeys.lastSeen(orgId),
    liveKeys.latest(orgId),
    liveKeys.geo(orgId),
    fix.agentId,
    String(fix.recordedAt),
    JSON.stringify(fix),
    String(fix.lng),
    String(fix.lat),
  );
  return result === 1;
}

export async function getLatestFixes(
  orgId: string,
  agentIds: string[],
): Promise<Map<string, LiveFix>> {
  const fixes = new Map<string, LiveFix>();
  if (agentIds.length === 0) return fixes;
  const values = await getRedis().hmget(liveKeys.latest(orgId), ...agentIds);
  values.forEach((value, index) => {
    if (value) fixes.set(agentIds[index]!, JSON.parse(value) as LiveFix);
  });
  return fixes;
}

/** Newest fix time (epoch ms) per agent, or null. */
export async function getLastSeen(orgId: string, agentIds: string[]): Promise<(number | null)[]> {
  if (agentIds.length === 0) return [];
  const scores = await getRedis().zmscore(liveKeys.lastSeen(orgId), ...agentIds);
  return scores.map((score) => (score === null ? null : Number(score)));
}

/**
 * Claims `(sessionId, seq)` pairs with SET NX. Returns the seqs claimed by THIS call; the rest
 * were already ingested (client retry / duplicate upload).
 */
export async function claimSamples(sessionId: string, seqs: number[]): Promise<Set<number>> {
  if (seqs.length === 0) return new Set();
  const pipeline = getRedis().pipeline();
  for (const seq of seqs)
    pipeline.set(liveKeys.dedupe(sessionId, seq), '1', 'EX', DEDUPE_TTL_SEC, 'NX');
  const results = (await pipeline.exec()) ?? [];
  const claimed = new Set<number>();
  results.forEach(([error, reply], index) => {
    if (!error && reply === 'OK') claimed.add(seqs[index]!);
  });
  return claimed;
}

/** Releases claims after a failed write so that a client retry is not treated as duplicate. */
export async function releaseSamples(sessionId: string, seqs: number[]): Promise<void> {
  if (seqs.length === 0) return;
  await getRedis().del(...seqs.map((seq) => liveKeys.dedupe(sessionId, seq)));
}

export interface SampleForMotion {
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps: number | null;
  recordedAt: number;
}

/** Carries the "stationary since" marker forward from the previous fix. */
export function nextStationarySince(prev: LiveFix | null, sample: SampleForMotion): number | null {
  const distance = prev ? haversineMeters(prev, sample) : 0;
  const elapsedSec = prev ? Math.max(1, (sample.recordedAt - prev.recordedAt) / 1000) : 1;
  const speed = sample.speedMps ?? (prev ? distance / elapsedSec : 0);
  const displaced = prev !== null && distance > Math.max(MIN_DISPLACEMENT_M, sample.accuracyM);
  if (speed >= MOVING_SPEED_MPS || displaced) return null;
  return prev?.stationarySince ?? prev?.recordedAt ?? sample.recordedAt;
}

export function motionOf(fix: Pick<LiveFix, 'stationarySince' | 'recordedAt'>): MotionStatus {
  if (fix.stationarySince === null) return 'moving';
  return fix.recordedAt - fix.stationarySince >= STOPPED_AFTER_MS ? 'stopped' : 'idle';
}

export function computeConnectivity(
  shiftStatus: ShiftStatus,
  lastSeenMs: number | null,
  nowMs: number,
  settings: { staleAfterSec: number; offlineAfterSec: number },
): ConnectivityStatus {
  if (shiftStatus === 'off_shift' || lastSeenMs === null) return 'offline';
  const ageSec = (nowMs - lastSeenMs) / 1000;
  if (ageSec < settings.staleAfterSec) return 'online';
  if (ageSec < settings.offlineAfterSec) return 'stale';
  return 'offline';
}

/** Stores the connectivity last published for an agent; returns true when it changed. */
export async function updateConnectivityState(
  orgId: string,
  agentId: string,
  connectivity: ConnectivityStatus,
): Promise<boolean> {
  const redis = getRedis();
  const previous = await redis.hget(liveKeys.connectivity(orgId), agentId);
  if (previous === connectivity) return false;
  await redis.hset(liveKeys.connectivity(orgId), agentId, connectivity);
  return true;
}

export async function getConnectivityStates(
  orgId: string,
  agentIds: string[],
): Promise<(string | null)[]> {
  if (agentIds.length === 0) return [];
  return getRedis().hmget(liveKeys.connectivity(orgId), ...agentIds);
}
