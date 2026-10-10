import { env } from '../../config/env.js';
import { notFound } from '../../lib/errors.js';
import { publishLocationUpdate } from '../../realtime/publisher.js';
import type { TelemetryFlag, TelemetryRejectReason } from '../../shared/enums.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile, type AgentProfileDoc } from '../agents/agent.model.js';
import {
  claimSamples,
  getConnectivityStates,
  getLatestFixes,
  motionOf,
  nextStationarySince,
  releaseSamples,
  saveLatestIfNewer,
  type LiveFix,
} from './live-state.js';
import { publishStatusFor, shiftNotActive } from './shift.service.js';
import { LocationTelemetry } from './telemetry.model.js';
import { TrackingSession } from './tracking-session.model.js';
import type {
  TelemetryBatchBody,
  TelemetryResultDto,
  TelemetrySample,
} from './tracking.schemas.js';

/** Accuracy worse than this is stored but flagged (weak evidence for visits/anomalies). */
export const LOW_ACCURACY_THRESHOLD_M = 100;

type AgentRef = Pick<AgentProfileDoc, '_id' | 'teamId' | 'shiftStatus'>;

interface ParsedSample extends TelemetrySample {
  recordedAtMs: number;
  flags: TelemetryFlag[];
}

function flagsFor(sample: TelemetrySample): TelemetryFlag[] {
  const flags: TelemetryFlag[] = [];
  if (sample.accuracyM > LOW_ACCURACY_THRESHOLD_M) flags.push('low_accuracy');
  if (sample.isMock === true) flags.push('mock_location');
  return flags;
}

/**
 * Ingests one batch of GPS samples from the agent's device.
 *
 * 1. The session must be the caller's active shift.
 * 2. Each sample is time-checked (future skew, max age, not before the shift started).
 * 3. Duplicates are dropped — within the batch and across retries (Redis SET NX per seq).
 * 4. Accepted samples are persisted to the time-series history.
 * 5. The newest sample updates the live position in Redis (ignored if older than what is
 *    already there), the agent profile, and is broadcast as `location:update`.
 */
export async function ingestTelemetry(
  actor: Actor,
  body: TelemetryBatchBody,
): Promise<TelemetryResultDto> {
  const receivedAt = new Date();
  const now = receivedAt.getTime();

  const profile = await AgentProfile.findOne({ orgId: actor.orgId, userId: actor.userId })
    .select('_id teamId shiftStatus')
    .lean();
  if (!profile) throw notFound('Agent profile');

  const session = await TrackingSession.findOne({
    _id: body.sessionId,
    orgId: actor.orgId,
    agentId: profile._id,
    isActive: true,
  })
    .select('_id startedAt teamId')
    .lean();
  if (!session) throw shiftNotActive();

  const rejected: { seq: number; reason: TelemetryRejectReason }[] = [];
  const candidates: ParsedSample[] = [];
  const seenInBatch = new Set<number>();
  const maxFuture = now + env.TELEMETRY_MAX_FUTURE_SKEW_SEC * 1000;
  const minPast = now - env.TELEMETRY_MAX_AGE_SEC * 1000;
  const shiftStart = session.startedAt.getTime() - env.TELEMETRY_MAX_FUTURE_SKEW_SEC * 1000;

  for (const sample of body.samples) {
    const recordedAtMs = Date.parse(sample.recordedAt);
    let reason: TelemetryRejectReason | null = null;
    if (seenInBatch.has(sample.seq)) reason = 'duplicate_in_batch';
    else if (recordedAtMs > maxFuture) reason = 'future_timestamp';
    else if (recordedAtMs < minPast) reason = 'too_old';
    else if (recordedAtMs < shiftStart) reason = 'before_shift';
    seenInBatch.add(sample.seq);
    if (reason) rejected.push({ seq: sample.seq, reason });
    else candidates.push({ ...sample, recordedAtMs, flags: flagsFor(sample) });
  }

  const sessionId = idString(session._id);
  const claimed = await claimSamples(
    sessionId,
    candidates.map((sample) => sample.seq),
  );
  const accepted = candidates
    .filter((sample) => claimed.has(sample.seq))
    .sort((a, b) => a.recordedAtMs - b.recordedAtMs);
  const duplicates = candidates.length - accepted.length;

  const result = (count: number): TelemetryResultDto => ({
    accepted: count,
    duplicates,
    rejected,
    serverTime: receivedAt.toISOString(),
  });
  if (accepted.length === 0) return result(0);

  const meta = { orgId: toObjectId(actor.orgId), agentId: profile._id, sessionId: session._id };
  try {
    await LocationTelemetry.insertMany(
      accepted.map((sample) => ({
        recordedAt: new Date(sample.recordedAtMs),
        receivedAt,
        meta,
        seq: sample.seq,
        lat: sample.lat,
        lng: sample.lng,
        accuracyM: sample.accuracyM,
        speedMps: sample.speedMps ?? null,
        headingDeg: sample.headingDeg ?? null,
        altitudeM: sample.altitudeM ?? null,
        batteryPct: sample.batteryPct ?? null,
        flags: sample.flags,
      })),
      { ordered: true },
    );
  } catch (error) {
    // Let the device retry the batch instead of it being swallowed as "duplicate".
    await releaseSamples(
      sessionId,
      accepted.map((sample) => sample.seq),
    );
    throw error;
  }

  const lastSample = accepted.at(-1)!;
  await TrackingSession.updateOne(
    { _id: session._id, orgId: actor.orgId },
    {
      $inc: { sampleCount: accepted.length },
      $max: { lastSampleAt: new Date(lastSample.recordedAtMs) },
    },
  );

  await updateLivePosition(actor.orgId, profile, sessionId, accepted, receivedAt);
  return result(accepted.length);
}

async function updateLivePosition(
  orgId: string,
  profile: AgentRef,
  sessionId: string,
  samples: ParsedSample[],
  receivedAt: Date,
): Promise<void> {
  const agentId = profile._id.toString();
  const teamId = profile.teamId ? profile.teamId.toString() : null;
  let prev: LiveFix | null = (await getLatestFixes(orgId, [agentId])).get(agentId) ?? null;
  // An older-than-live batch (late upload) never moves the live marker backwards.
  const fresh = samples.filter((sample) => !prev || sample.recordedAtMs > prev.recordedAt);
  if (fresh.length === 0) return;

  let fix: LiveFix | null = null;
  for (const sample of fresh) {
    fix = {
      agentId,
      teamId,
      sessionId,
      lat: sample.lat,
      lng: sample.lng,
      accuracyM: sample.accuracyM,
      speedMps: sample.speedMps ?? null,
      headingDeg: sample.headingDeg ?? null,
      batteryPct: sample.batteryPct ?? null,
      flags: sample.flags,
      recordedAt: sample.recordedAtMs,
      receivedAt: receivedAt.getTime(),
      stationarySince: nextStationarySince(prev, {
        lat: sample.lat,
        lng: sample.lng,
        accuracyM: sample.accuracyM,
        speedMps: sample.speedMps ?? null,
        recordedAt: sample.recordedAtMs,
      }),
    };
    prev = fix;
  }
  if (!fix || !(await saveLatestIfNewer(orgId, fix))) return;

  const recordedAt = new Date(fix.recordedAt);
  await AgentProfile.updateOne(
    {
      orgId,
      _id: profile._id,
      $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: recordedAt } }],
    },
    {
      $set: {
        lastSeenAt: recordedAt,
        lastLocation: {
          point: { type: 'Point', coordinates: [fix.lng, fix.lat] },
          accuracyM: fix.accuracyM,
          recordedAt,
        },
      },
    },
  );

  publishLocationUpdate(orgId, {
    agentId,
    teamId,
    position: { lat: fix.lat, lng: fix.lng },
    accuracyM: fix.accuracyM,
    speedMps: fix.speedMps,
    headingDeg: fix.headingDeg,
    batteryPct: fix.batteryPct,
    motion: motionOf(fix),
    flags: fix.flags,
    recordedAt: recordedAt.toISOString(),
    receivedAt: receivedAt.toISOString(),
  });
  // Re-evaluate connectivity right away (e.g. stale -> online) instead of waiting for the sweep.
  await publishStatusIfChanged(orgId, profile);
}

async function publishStatusIfChanged(orgId: string, profile: AgentRef): Promise<void> {
  const [stored] = await getConnectivityStates(orgId, [idString(profile._id)]);
  if (stored !== 'online') await publishStatusFor(orgId, profile);
}
