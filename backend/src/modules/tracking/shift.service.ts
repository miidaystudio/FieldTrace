import type { Types } from 'mongoose';
import { AppError, ErrorCode, notFound } from '../../lib/errors.js';
import { publishAgentStatus } from '../../realtime/publisher.js';
import type { ShiftStatus } from '../../shared/enums.js';
import { idString, isoOrNull } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile } from '../agents/agent.model.js';
import { getOrgSettings } from '../organizations/settings-cache.js';
import { finalizePresence } from '../visits/geofence-engine.js';
import { computeConnectivity, getLastSeen, updateConnectivityState } from './live-state.js';
import {
  TrackingSession,
  type SessionEndReason,
  type TrackingSessionDoc,
} from './tracking-session.model.js';
import type { ShiftSessionDto, StartShiftBody } from './tracking.schemas.js';

export const shiftNotActive = () =>
  new AppError(409, ErrorCode.SHIFT_NOT_ACTIVE, 'No active shift; start a shift first');

export function toShiftSessionDto(
  doc: TrackingSessionDoc,
  shiftStatus: ShiftStatus,
): ShiftSessionDto {
  return {
    id: idString(doc._id),
    agentId: idString(doc.agentId),
    isActive: doc.isActive,
    shiftStatus: doc.isActive ? shiftStatus : 'off_shift',
    startedAt: doc.startedAt.toISOString(),
    endedAt: isoOrNull(doc.endedAt),
    sampleCount: doc.sampleCount,
    lastSampleAt: isoOrNull(doc.lastSampleAt),
    device: { platform: doc.device.platform, appVersion: doc.device.appVersion },
  };
}

async function loadOwnProfile(actor: Actor) {
  const profile = await AgentProfile.findOne({ orgId: actor.orgId, userId: actor.userId });
  if (!profile) throw notFound('Agent profile');
  return profile;
}

/** Recomputes the agent's connectivity, stores it and broadcasts `agent:status`. */
export async function publishStatusFor(
  orgId: string,
  agent: { _id: Types.ObjectId; teamId: Types.ObjectId | null; shiftStatus: ShiftStatus },
): Promise<void> {
  const agentId = idString(agent._id);
  const [settings, [lastSeen]] = await Promise.all([
    getOrgSettings(orgId),
    getLastSeen(orgId, [agentId]),
  ]);
  const connectivity = computeConnectivity(
    agent.shiftStatus,
    lastSeen ?? null,
    Date.now(),
    settings,
  );
  await updateConnectivityState(orgId, agentId, connectivity);
  publishAgentStatus(orgId, {
    agentId,
    teamId: agent.teamId ? idString(agent.teamId) : null,
    shiftStatus: agent.shiftStatus,
    connectivity,
    lastSeenAt: lastSeen ? new Date(lastSeen).toISOString() : null,
  });
}

export async function getCurrentShift(actor: Actor): Promise<{ session: ShiftSessionDto | null }> {
  const profile = await loadOwnProfile(actor);
  const session = await TrackingSession.findOne({
    orgId: actor.orgId,
    agentId: profile._id,
    isActive: true,
  }).lean();
  return { session: session ? toShiftSessionDto(session, profile.shiftStatus) : null };
}

/** Idempotent: returns the already-active shift if there is one. */
export async function startShift(
  actor: Actor,
  body: StartShiftBody,
  userAgent: string | undefined,
): Promise<ShiftSessionDto> {
  const profile = await loadOwnProfile(actor);
  let session = await TrackingSession.findOne({
    orgId: actor.orgId,
    agentId: profile._id,
    isActive: true,
  }).lean();

  if (!session) {
    try {
      session = (
        await TrackingSession.create({
          orgId: actor.orgId,
          agentId: profile._id,
          userId: actor.userId,
          teamId: profile.teamId,
          startedAt: new Date(),
          device: {
            platform: body.device?.platform ?? 'other',
            appVersion: body.device?.appVersion ?? null,
            userAgent: userAgent?.slice(0, 512) ?? null,
          },
        })
      ).toObject();
    } catch (error) {
      // Lost a race with a concurrent start (unique partial index) -> return the winner.
      if ((error as { code?: number }).code !== 11000) throw error;
      session = await TrackingSession.findOne({
        orgId: actor.orgId,
        agentId: profile._id,
        isActive: true,
      }).lean();
      if (!session) throw error;
    }
  }

  if (profile.shiftStatus === 'off_shift') {
    profile.shiftStatus = 'on_shift';
    await profile.save();
    await publishStatusFor(actor.orgId, profile);
  }
  return toShiftSessionDto(session, profile.shiftStatus);
}

export async function setBreak(actor: Actor, onBreak: boolean): Promise<ShiftSessionDto> {
  const profile = await loadOwnProfile(actor);
  const session = await TrackingSession.findOne({
    orgId: actor.orgId,
    agentId: profile._id,
    isActive: true,
  }).lean();
  if (!session) throw shiftNotActive();

  const next: ShiftStatus = onBreak ? 'on_break' : 'on_shift';
  if (profile.shiftStatus !== next) {
    profile.shiftStatus = next;
    await profile.save();
    await publishStatusFor(actor.orgId, profile);
  }
  return toShiftSessionDto(session, next);
}

/** Ends the agent's active session (if any). Shared by "end shift" and agent deactivation. */
export async function endActiveSession(
  orgId: string,
  agentId: Types.ObjectId | string,
  reason: SessionEndReason,
): Promise<TrackingSessionDoc | null> {
  const ended = await TrackingSession.findOneAndUpdate(
    { orgId, agentId, isActive: true },
    { $set: { isActive: false, endedAt: new Date(), endReason: reason } },
    { returnDocument: 'after' },
  ).lean();
  const profile = await AgentProfile.findOneAndUpdate(
    { orgId, _id: agentId },
    { $set: { shiftStatus: 'off_shift' } },
    { returnDocument: 'after' },
  ).lean();
  if (profile) {
    // A stay in progress ends with the shift (visit closed at the last fix inside).
    await finalizePresence(orgId, profile, 'shift_ended');
    await publishStatusFor(orgId, profile);
  }
  return ended;
}

export async function endShift(actor: Actor): Promise<ShiftSessionDto> {
  const profile = await loadOwnProfile(actor);
  const ended = await endActiveSession(actor.orgId, profile._id, 'ended_by_agent');
  if (!ended) throw shiftNotActive();
  return toShiftSessionDto(ended, 'off_shift');
}
