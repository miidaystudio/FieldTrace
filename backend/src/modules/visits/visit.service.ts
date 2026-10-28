import type { Types } from 'mongoose';
import {
  AppError,
  ErrorCode,
  badRequest,
  conflict,
  invalidTransition,
  notFound,
} from '../../lib/errors.js';
import { pageMeta, skipFor, toMongoSort } from '../../lib/pagination.js';
import { publishVisitUpdated } from '../../realtime/publisher.js';
import type { VisitMethod, VisitReviewReason } from '../../shared/enums.js';
import { idString, isoOrNull, toLatLng, toObjectId, type LatLng } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { AgentProfile } from '../agents/agent.model.js';
import { raiseVisitIssue, settleVisitIssue } from '../anomalies/anomaly.service.js';
import { findOpenAssignmentFor, systemTransition } from '../assignments/assignment.service.js';
import { Assignment, type AssignmentDoc } from '../assignments/assignment.model.js';
import { recordAudit } from '../audit/audit.service.js';
import { ClientLocation } from '../locations/location.model.js';
import { getOrgSettings, orgDayOf } from '../organizations/settings-cache.js';
import { isTeamInScope, resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { TrackingSession } from '../tracking/tracking-session.model.js';
import { User } from '../users/user.model.js';
import {
  containment,
  getOrgGeofences,
  isWithinTolerance,
  type IndexedGeofence,
} from './geofence-index.js';
import { getPresence, savePresence, signalsFrom } from './presence.js';
import { Visit, type VisitDoc, type VisitEvidence, type VisitSignals } from './visit.model.js';
import type {
  CheckInBody,
  CheckOutBody,
  ListVisitsQuery,
  MyVisitsQuery,
  ReviewVisitBody,
  VisitDto,
} from './visit.schemas.js';

/** Average accuracy worse than this means the GPS evidence is too weak to auto-verify. */
export const VERIFY_MAX_AVG_ACCURACY_M = 50;

// ------------------------------------------------------------------ DTO

type Summary = { id: string; name: string };
type LocationSummary = NonNullable<VisitDto['location']>;

export async function toVisitDtos(orgId: string, docs: VisitDoc[]): Promise<VisitDto[]> {
  const agentIds = [...new Set(docs.map((d) => idString(d.agentId)))];
  const locationIds = [...new Set(docs.map((d) => idString(d.locationId)))];
  const [profiles, locations] = await Promise.all([
    AgentProfile.find({ orgId, _id: { $in: agentIds } })
      .select('userId')
      .lean(),
    ClientLocation.find({ orgId, _id: { $in: locationIds } })
      .select('name address point')
      .lean(),
  ]);
  const users = await User.find({ orgId, _id: { $in: profiles.map((p) => p.userId) } })
    .select('name')
    .lean();
  const names = new Map(users.map((u) => [idString(u._id), u.name]));
  const agents = new Map<string, Summary>(
    profiles.map((p) => [
      idString(p._id),
      { id: idString(p._id), name: names.get(idString(p.userId)) ?? 'Unknown agent' },
    ]),
  );
  const locationMap = new Map<string, LocationSummary>(
    locations.map((l) => [
      idString(l._id),
      {
        id: idString(l._id),
        name: l.name,
        address: l.address,
        position: toLatLng(l.point.coordinates),
      },
    ]),
  );

  return docs.map((doc) => ({
    id: idString(doc._id),
    agentId: idString(doc.agentId),
    agent: agents.get(idString(doc.agentId)) ?? null,
    teamId: doc.teamId ? idString(doc.teamId) : null,
    locationId: idString(doc.locationId),
    location: locationMap.get(idString(doc.locationId)) ?? null,
    assignmentId: doc.assignmentId ? idString(doc.assignmentId) : null,
    method: doc.method,
    status: doc.status,
    isOpen: doc.isOpen,
    visitDate: doc.visitDate,
    checkInAt: isoOrNull(doc.checkInAt),
    checkOutAt: isoOrNull(doc.checkOutAt),
    durationSec: doc.durationSec,
    arrival: doc.arrival
      ? {
          windowStart: doc.arrival.windowStart.toISOString(),
          windowEnd: doc.arrival.windowEnd.toISOString(),
          delaySec: doc.arrival.delaySec,
          onTime: doc.arrival.onTime,
        }
      : null,
    signals: {
      sampleCount: doc.signals.sampleCount,
      avgAccuracyM: doc.signals.avgAccuracyM,
      maxAccuracyM: doc.signals.maxAccuracyM,
      mockLocation: doc.signals.mockLocation,
    },
    reviewReasons: [...doc.reviewReasons],
    evidence: doc.evidence.map((e) => ({
      type: e.type,
      at: e.at.toISOString(),
      position: { lat: e.lat, lng: e.lng },
      accuracyM: e.accuracyM,
      insideGeofence: e.insideGeofence,
      distanceM: e.distanceM,
    })),
    review: doc.review
      ? {
          by: idString(doc.review.by),
          at: doc.review.at.toISOString(),
          decision: doc.review.decision,
          note: doc.review.note,
        }
      : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

async function publish(orgId: string, doc: VisitDoc): Promise<VisitDto> {
  const [dto] = await toVisitDtos(orgId, [doc]);
  publishVisitUpdated(orgId, dto!);
  return dto!;
}

export function evidenceAt(
  type: VisitEvidence['type'],
  at: Date,
  point: LatLng,
  accuracyM: number | null,
  fence: IndexedGeofence | null,
): VisitEvidence {
  const c = fence ? containment(fence, point) : null;
  return {
    type,
    at,
    lat: point.lat,
    lng: point.lng,
    accuracyM,
    insideGeofence: fence ? isWithinTolerance(fence, point, accuracyM) : false,
    distanceM: c ? Math.round(c.distanceM) : null,
  };
}

function arrivalFor(assignment: AssignmentDoc | null, checkInAt: Date): VisitDoc['arrival'] {
  if (!assignment?.window) return null;
  const delaySec = Math.round((checkInAt.getTime() - assignment.window.end.getTime()) / 1000);
  return {
    windowStart: assignment.window.start,
    windowEnd: assignment.window.end,
    delaySec,
    onTime: checkInAt.getTime() <= assignment.window.end.getTime(),
  };
}

// ------------------------------------------------------------------ lifecycle (system + manual)

interface OpenVisitInput {
  orgId: string;
  agent: { _id: Types.ObjectId; teamId: Types.ObjectId | null };
  fence: IndexedGeofence;
  sessionId: string | null;
  method: VisitMethod;
  checkInAt: Date;
  evidence: VisitEvidence[];
  signals: VisitSignals;
  reasons?: VisitReviewReason[];
  assignment?: AssignmentDoc | null;
}

/**
 * Opens a visit (status `in_progress`) and links it to the agent's assignment at that location
 * for the day, moving the assignment to `in_progress`. If the agent already has an open visit
 * at the same location, that visit is returned instead (idempotent).
 */
export async function openVisit(input: OpenVisitInput): Promise<VisitDoc | null> {
  const { orgId, agent, fence } = input;
  const existing = await Visit.findOne({ orgId, agentId: agent._id, isOpen: true }).lean();
  if (existing) return idString(existing.locationId) === fence.locationId ? existing : null;

  const visitDate = await orgDayOf(orgId, input.checkInAt);
  const assignment =
    input.assignment ??
    (await findOpenAssignmentFor(orgId, agent._id, fence.locationId, visitDate));

  let visit: VisitDoc;
  try {
    visit = (
      await Visit.create({
        orgId,
        agentId: agent._id,
        teamId: agent.teamId,
        locationId: fence.locationId,
        assignmentId: assignment?._id ?? null,
        sessionId: input.sessionId,
        method: input.method,
        status: 'in_progress',
        isOpen: true,
        visitDate,
        checkInAt: input.checkInAt,
        arrival: arrivalFor(assignment, input.checkInAt),
        signals: input.signals,
        reviewReasons: input.reasons ?? [],
        evidence: input.evidence,
      })
    ).toObject();
  } catch (error) {
    // Lost a race against another open (unique partial index): reuse it if it is the same site.
    if ((error as { code?: number }).code !== 11000) throw error;
    const winner = await Visit.findOne({ orgId, agentId: agent._id, isOpen: true }).lean();
    return winner && idString(winner.locationId) === fence.locationId ? winner : null;
  }

  if (assignment) {
    await systemTransition(
      orgId,
      assignment._id,
      ['pending', 'overdue'],
      'in_progress',
      'Visit started at the location',
    );
  }
  await publish(orgId, visit);
  return visit;
}

interface CloseVisitInput {
  checkOutAt: Date;
  evidence?: VisitEvidence[];
  signals?: VisitSignals;
  reasons?: VisitReviewReason[];
}

/**
 * Closes an open visit and decides its outcome. A visit is auto-`verified` only when every
 * check passes; otherwise it goes to `needs_review` with the reasons attached. Never rejected
 * automatically — that is a human decision.
 */
export async function closeVisit(
  orgId: string,
  visitId: string,
  input: CloseVisitInput,
): Promise<VisitDoc | null> {
  const visit = await Visit.findOne({ _id: visitId, orgId, isOpen: true }).lean();
  if (!visit) return null;

  const fences = await getOrgGeofences(orgId);
  const fence = fences.find((f) => f.locationId === idString(visit.locationId));
  const minDwellSec =
    fence?.minDwellSec ?? (await getOrgSettings(orgId)).geofenceDefaults.minDwellSec;
  const signals = input.signals ?? visit.signals;
  const checkInAt = visit.checkInAt ?? input.checkOutAt;
  const durationSec = Math.max(
    0,
    Math.round((input.checkOutAt.getTime() - checkInAt.getTime()) / 1000),
  );

  const reasons = new Set<VisitReviewReason>([...visit.reviewReasons, ...(input.reasons ?? [])]);
  if (signals.sampleCount === 0) reasons.add('no_gps_presence');
  if (signals.avgAccuracyM !== null && signals.avgAccuracyM > VERIFY_MAX_AVG_ACCURACY_M)
    reasons.add('low_accuracy');
  if (signals.mockLocation) reasons.add('mock_location');
  if (durationSec < minDwellSec) reasons.add('insufficient_dwell');
  // Photo / QR evidence is not collected yet, so such sites always need a human check.
  if (fence?.requireQr || fence?.requirePhoto) reasons.add('evidence_required');

  const status = reasons.size === 0 ? 'verified' : 'needs_review';
  const updated = await Visit.findOneAndUpdate(
    { _id: visit._id, orgId, isOpen: true },
    {
      $set: {
        isOpen: false,
        status,
        checkOutAt: input.checkOutAt,
        durationSec,
        signals,
        reviewReasons: [...reasons],
      },
      $push: { evidence: { $each: input.evidence ?? [] } },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) return null;

  if (status === 'verified' && updated.assignmentId) {
    await systemTransition(
      orgId,
      updated.assignmentId,
      ['pending', 'overdue', 'in_progress'],
      'completed',
      'Visit verified automatically',
    );
  }
  await publish(orgId, updated);
  await raiseVisitIssue(orgId, updated);
  return updated;
}

// ------------------------------------------------------------------ driver (manual) endpoints

async function ownProfile(actor: Actor) {
  const profile = await AgentProfile.findOne({ orgId: actor.orgId, userId: actor.userId })
    .select('_id teamId')
    .lean();
  if (!profile) throw notFound('Agent profile');
  return profile;
}

/**
 * Manual check-in from the driver app. The reported position is recorded as evidence; a
 * check-in outside the geofence is accepted but flagged for review.
 */
export async function checkIn(actor: Actor, body: CheckInBody): Promise<VisitDto> {
  const profile = await ownProfile(actor);

  let assignment: AssignmentDoc | null = null;
  let locationId = body.locationId ?? null;
  if (body.assignmentId) {
    assignment = await Assignment.findOne({
      _id: body.assignmentId,
      orgId: actor.orgId,
      agentId: profile._id,
    }).lean();
    if (!assignment) throw notFound('Assignment');
    if (assignment.status === 'completed' || assignment.status === 'cancelled') {
      throw invalidTransition(`Assignment is already ${assignment.status}`);
    }
    locationId = idString(assignment.locationId);
  }

  const fence = (await getOrgGeofences(actor.orgId)).find((f) => f.locationId === locationId);
  if (!fence)
    throw badRequest('locationId does not reference an active location in your organization');

  const open = await Visit.findOne({
    orgId: actor.orgId,
    agentId: profile._id,
    isOpen: true,
  }).lean();
  if (open) {
    if (idString(open.locationId) === fence.locationId)
      return (await toVisitDtos(actor.orgId, [open]))[0]!;
    throw conflict('Check out of your current visit before checking in elsewhere');
  }

  const now = new Date();
  const evidence = evidenceAt('manual_checkin', now, body.position, body.accuracyM, fence);
  const session = await TrackingSession.findOne({
    orgId: actor.orgId,
    agentId: profile._id,
    isActive: true,
  })
    .select('_id')
    .lean();
  const presence = await getPresence(actor.orgId, idString(profile._id));
  const samePresence = presence?.locationId === fence.locationId ? presence : null;

  const visit = await openVisit({
    orgId: actor.orgId,
    agent: profile,
    fence,
    sessionId: session ? idString(session._id) : null,
    method: 'manual',
    // If GPS already shows the agent inside, the stay started at the geofence entry.
    checkInAt: samePresence ? new Date(samePresence.enteredAt) : now,
    evidence: [evidence],
    signals: signalsFrom(samePresence),
    reasons: evidence.insideGeofence ? [] : ['checkin_outside_geofence'],
    assignment,
  });
  if (!visit) throw conflict('Check out of your current visit before checking in elsewhere');
  if (samePresence && !samePresence.visitId) {
    await savePresence(actor.orgId, idString(profile._id), {
      ...samePresence,
      visitId: idString(visit._id),
    });
  }
  return (await toVisitDtos(actor.orgId, [visit]))[0]!;
}

export async function checkOut(
  actor: Actor,
  visitId: string,
  body: CheckOutBody,
): Promise<VisitDto> {
  const profile = await ownProfile(actor);
  const visit = await Visit.findOne({
    _id: visitId,
    orgId: actor.orgId,
    agentId: profile._id,
  }).lean();
  if (!visit) throw notFound('Visit');
  if (!visit.isOpen) throw invalidTransition('Visit is already closed');

  const agentId = idString(profile._id);
  const fence =
    (await getOrgGeofences(actor.orgId)).find((f) => f.locationId === idString(visit.locationId)) ??
    null;
  const presence = await getPresence(actor.orgId, agentId);
  const samePresence = presence?.locationId === idString(visit.locationId) ? presence : null;
  const now = new Date();

  const closed = await closeVisit(actor.orgId, visitId, {
    checkOutAt: now,
    evidence: [evidenceAt('manual_checkout', now, body.position, body.accuracyM, fence)],
    signals: samePresence ? signalsFrom(samePresence) : visit.signals,
  });
  if (!closed) throw invalidTransition('Visit is already closed');
  // The GPS stay may continue; it must not reopen or re-close this visit.
  if (samePresence?.visitId === visitId)
    await savePresence(actor.orgId, agentId, { ...samePresence, visitId: null });
  return (await toVisitDtos(actor.orgId, [closed]))[0]!;
}

// ------------------------------------------------------------------ dashboard endpoints

async function findVisitInScope(actor: Actor, id: string) {
  const visit = await Visit.findOne({ _id: id, orgId: actor.orgId }).lean();
  if (!visit) throw notFound('Visit');
  if (actor.role === 'agent') {
    const own = await AgentProfile.exists({
      orgId: actor.orgId,
      userId: actor.userId,
      _id: visit.agentId,
    });
    if (!own) throw notFound('Visit');
  } else if (!isTeamInScope(await resolveTeamScope(actor), visit.teamId)) {
    throw notFound('Visit');
  }
  return visit;
}

function dateFilter(query: { date?: string; dateFrom?: string; dateTo?: string }) {
  if (query.date) return { visitDate: query.date };
  if (query.dateFrom || query.dateTo) {
    return {
      visitDate: {
        ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
        ...(query.dateTo ? { $lte: query.dateTo } : {}),
      },
    };
  }
  return {};
}

export async function listVisits(actor: Actor, query: ListVisitsQuery) {
  const scope = await resolveTeamScope(actor);
  const conditions: Record<string, unknown>[] = [teamScopeFilter(scope), dateFilter(query)];
  if (query.status) conditions.push({ status: { $in: query.status } });
  if (query.agentId) conditions.push({ agentId: toObjectId(query.agentId) });
  if (query.locationId) conditions.push({ locationId: toObjectId(query.locationId) });
  if (query.assignmentId) conditions.push({ assignmentId: toObjectId(query.assignmentId) });
  const filter = { orgId: toObjectId(actor.orgId), $and: conditions };
  const [docs, total] = await Promise.all([
    Visit.find(filter)
      .sort(toMongoSort(query.sort))
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    Visit.countDocuments(filter),
  ]);
  return {
    data: await toVisitDtos(actor.orgId, docs),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function listMyVisits(actor: Actor, query: MyVisitsQuery) {
  const profile = await ownProfile(actor);
  const filter: Record<string, unknown> = {
    orgId: toObjectId(actor.orgId),
    agentId: profile._id,
    ...dateFilter(query),
  };
  const [docs, total] = await Promise.all([
    Visit.find(filter)
      .sort(toMongoSort(query.sort))
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    Visit.countDocuments(filter),
  ]);
  return {
    data: await toVisitDtos(actor.orgId, docs),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function getVisit(actor: Actor, id: string): Promise<VisitDto> {
  return (await toVisitDtos(actor.orgId, [await findVisitInScope(actor, id)]))[0]!;
}

/**
 * Manager decision on a closed visit (override allowed, always audited). Verifying completes the
 * linked assignment; rejecting leaves the assignment for the manager to handle.
 */
export async function reviewVisit(
  actor: Actor,
  id: string,
  body: ReviewVisitBody,
): Promise<VisitDto> {
  const visit = await findVisitInScope(actor, id);
  if (visit.isOpen) throw invalidTransition('The visit is still open; wait for check-out');
  if (visit.status === 'missed' && body.decision === 'verified') {
    throw new AppError(
      409,
      ErrorCode.INVALID_STATE_TRANSITION,
      'A missed visit has no evidence to verify',
    );
  }

  const review = {
    by: toObjectId(actor.userId),
    at: new Date(),
    decision: body.decision,
    note: body.note ?? null,
  };
  const updated = await Visit.findOneAndUpdate(
    { _id: visit._id, orgId: actor.orgId },
    { $set: { status: body.decision, review } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw notFound('Visit');

  await recordAudit(actor, {
    action: body.decision === 'verified' ? 'visit.verified_manually' : 'visit.rejected',
    entityType: 'visit',
    entityId: visit._id,
    changes: { status: { from: visit.status, to: body.decision } },
    metadata: { note: body.note ?? null, reviewReasons: visit.reviewReasons },
  });
  await settleVisitIssue(actor, visit._id, body.decision);
  if (body.decision === 'verified' && updated.assignmentId) {
    await systemTransition(
      actor.orgId,
      updated.assignmentId,
      ['pending', 'overdue', 'in_progress'],
      'completed',
      'Visit verified by reviewer',
    );
  }
  return publish(actor.orgId, updated);
}

/** Records a planned stop that was never visited (created once per assignment by the sweep). */
export async function recordMissedVisit(
  orgId: string,
  assignment: AssignmentDoc,
): Promise<boolean> {
  const exists = await Visit.exists({ orgId, assignmentId: assignment._id });
  if (exists) return false;
  const visit = await Visit.create({
    orgId,
    agentId: assignment.agentId,
    teamId: assignment.teamId,
    locationId: assignment.locationId,
    assignmentId: assignment._id,
    method: 'auto',
    status: 'missed',
    isOpen: false,
    visitDate: assignment.scheduledDate,
    signals: { sampleCount: 0, avgAccuracyM: null, maxAccuracyM: null, mockLocation: false },
  });
  await publish(orgId, visit.toObject());
  await raiseVisitIssue(orgId, visit.toObject());
  return true;
}
