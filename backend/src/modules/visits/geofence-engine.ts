import type { Types } from 'mongoose';
import { logger } from '../../lib/logger.js';
import { publishGeofenceTransition } from '../../realtime/publisher.js';
import type { TelemetryFlag, VisitReviewReason } from '../../shared/enums.js';
import { idString } from '../../shared/schemas.js';
import {
  findContaining,
  getOrgGeofences,
  isClearlyOutside,
  type IndexedGeofence,
} from './geofence-index.js';
import { GeofenceEvent } from './geofence-event.model.js';
import { getPresence, savePresence, signalsFrom, type Presence } from './presence.js';
import { closeVisit, evidenceAt, openVisit } from './visit.service.js';

/** Fixes less accurate than this are too vague to decide a transition (they still count as mock evidence). */
export const MAX_TRANSITION_ACCURACY_M = 100;
/** An exit is confirmed only after the agent has been clearly outside for this long. */
export const EXIT_DEBOUNCE_MS = 20_000;

export interface GeofenceSample {
  lat: number;
  lng: number;
  accuracyM: number;
  recordedAtMs: number;
  flags: TelemetryFlag[];
}

interface AgentRef {
  _id: Types.ObjectId;
  teamId: Types.ObjectId | null;
}

async function recordTransition(
  orgId: string,
  agent: AgentRef,
  fence: IndexedGeofence,
  type: 'entered' | 'exited',
  at: number,
  fix: { lat: number; lng: number; accuracyM: number | null },
  sessionId: string | null,
  dwellSec: number | null,
): Promise<void> {
  await GeofenceEvent.create({
    orgId,
    agentId: agent._id,
    teamId: agent.teamId,
    locationId: fence.locationId,
    sessionId,
    type,
    at: new Date(at),
    lat: fix.lat,
    lng: fix.lng,
    accuracyM: fix.accuracyM,
    dwellSec,
  });
  publishGeofenceTransition(orgId, {
    agentId: idString(agent._id),
    teamId: agent.teamId ? idString(agent.teamId) : null,
    locationId: fence.locationId,
    locationName: fence.name,
    type,
    at: new Date(at).toISOString(),
    position: { lat: fix.lat, lng: fix.lng },
    accuracyM: fix.accuracyM,
    dwellSec,
  });
}

/** Ends a stay: records the exit and closes the visit opened for it (if any). */
async function exitPresence(
  orgId: string,
  agent: AgentRef,
  presence: Presence,
  fence: IndexedGeofence | null,
  exitAt: number,
  reasons: VisitReviewReason[] = [],
): Promise<void> {
  const dwellSec = Math.max(0, Math.round((exitAt - presence.enteredAt) / 1000));
  // Position of the exit: the first fix clearly outside, or the last one inside when the stay
  // ended without leaving (shift ended, signal lost).
  const exitFix = presence.exitFix ?? presence.lastFix;
  if (fence) {
    await recordTransition(
      orgId,
      agent,
      fence,
      'exited',
      exitAt,
      exitFix,
      presence.sessionId,
      dwellSec,
    );
  }
  if (presence.visitId) {
    const exitEvidence = fence
      ? [evidenceAt('geofence_exit', new Date(exitAt), exitFix, exitFix.accuracyM, fence)]
      : [];
    await closeVisit(orgId, presence.visitId, {
      checkOutAt: new Date(exitAt),
      evidence: exitEvidence,
      signals: signalsFrom(presence),
      reasons,
    });
  }
}

/** Opens the visit once the agent has stayed inside for the location's minimum dwell. */
async function maybeOpenVisit(
  orgId: string,
  agent: AgentRef,
  fence: IndexedGeofence,
  presence: Presence,
  nowMs: number,
): Promise<void> {
  if (
    presence.visitId ||
    presence.visitSkipped ||
    nowMs - presence.enteredAt < fence.minDwellSec * 1000
  ) {
    return;
  }
  const visit = await openVisit({
    orgId,
    agent,
    fence,
    sessionId: presence.sessionId,
    method: 'auto',
    checkInAt: new Date(presence.enteredAt),
    evidence: [
      evidenceAt(
        'geofence_entry',
        new Date(presence.enteredAt),
        presence.lastFix,
        presence.lastFix.accuracyM,
        fence,
      ),
    ],
    signals: signalsFrom(presence),
  });
  // null = the agent has an open visit elsewhere (e.g. forgot to check out); mark as handled.
  if (visit) presence.visitId = idString(visit._id);
  else presence.visitSkipped = true;
}

/**
 * Runs geofence detection over an agent's new (in-order, not-late) GPS fixes:
 * entry → (after min dwell) visit opened → exit after debounce → visit closed and judged.
 */
export async function processGeofenceSamples(
  orgId: string,
  agent: AgentRef,
  sessionId: string,
  samples: GeofenceSample[],
): Promise<void> {
  if (samples.length === 0) return;
  const agentId = idString(agent._id);
  const fences = await getOrgGeofences(orgId);
  let presence = await getPresence(orgId, agentId);
  const original = JSON.stringify(presence);

  for (const sample of samples) {
    const point = { lat: sample.lat, lng: sample.lng };
    const isMock = sample.flags.includes('mock_location');
    if (presence && isMock) presence.mock = true;
    if (sample.accuracyM > MAX_TRANSITION_ACCURACY_M) continue;

    const containing = findContaining(fences, point);

    if (presence) {
      const fence = fences.find((f) => f.locationId === presence!.locationId) ?? null;
      const inside = fence !== null && !isClearlyOutside(fence, point, sample.accuracyM);
      if (inside) {
        presence.lastInsideAt = sample.recordedAtMs;
        presence.outsideSince = null;
        presence.exitFix = null;
        presence.sampleCount += 1;
        presence.accuracySum += sample.accuracyM;
        presence.maxAccuracyM = Math.max(presence.maxAccuracyM, sample.accuracyM);
        presence.lastFix = { lat: sample.lat, lng: sample.lng, accuracyM: sample.accuracyM };
        await maybeOpenVisit(orgId, agent, fence, presence, sample.recordedAtMs);
        continue;
      }
      if (presence.outsideSince === null) {
        presence.outsideSince = sample.recordedAtMs;
        presence.exitFix = { lat: sample.lat, lng: sample.lng, accuracyM: sample.accuracyM };
      }
      const movedToOtherSite = containing !== null && containing.locationId !== presence.locationId;
      const debounced = sample.recordedAtMs - presence.outsideSince >= EXIT_DEBOUNCE_MS;
      if (!fence || movedToOtherSite || debounced) {
        await exitPresence(orgId, agent, presence, fence, presence.outsideSince);
        presence = null;
      } else {
        continue;
      }
    }

    if (!presence && containing) {
      presence = {
        locationId: containing.locationId,
        sessionId,
        enteredAt: sample.recordedAtMs,
        lastInsideAt: sample.recordedAtMs,
        outsideSince: null,
        visitId: null,
        sampleCount: 1,
        accuracySum: sample.accuracyM,
        maxAccuracyM: sample.accuracyM,
        mock: isMock,
        lastFix: { lat: sample.lat, lng: sample.lng, accuracyM: sample.accuracyM },
      };
      await recordTransition(
        orgId,
        agent,
        containing,
        'entered',
        sample.recordedAtMs,
        presence.lastFix,
        sessionId,
        null,
      );
      await maybeOpenVisit(orgId, agent, containing, presence, sample.recordedAtMs);
    }
  }

  if (JSON.stringify(presence) !== original) await savePresence(orgId, agentId, presence);
}

/**
 * Closes an agent's current stay without a GPS exit — shift ended or the signal was lost while
 * inside. The visit ends at the last fix inside and is flagged for review when signal was lost.
 */
export async function finalizePresence(
  orgId: string,
  agent: AgentRef,
  reason: 'shift_ended' | 'signal_lost',
): Promise<void> {
  const agentId = idString(agent._id);
  const presence = await getPresence(orgId, agentId);
  if (!presence) return;
  const fence =
    (await getOrgGeofences(orgId)).find((f) => f.locationId === presence.locationId) ?? null;
  try {
    await exitPresence(
      orgId,
      agent,
      presence,
      fence,
      presence.lastInsideAt,
      reason === 'signal_lost' ? ['signal_lost'] : [],
    );
  } catch (error) {
    logger.error({ err: error, agentId }, 'Failed to finalize presence');
  }
  await savePresence(orgId, agentId, null);
}
