import type { Types } from 'mongoose';
import { badRequest, invalidTransition, notFound } from '../../lib/errors.js';
import { pageMeta, skipFor, toMongoSort } from '../../lib/pagination.js';
import { idString, isoOrNull, toLatLng, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { publishAssignmentUpdated } from '../../realtime/publisher.js';
import type { AssignmentStatus } from '../../shared/enums.js';
import { AgentProfile } from '../agents/agent.model.js';
import { findAgentInScope } from '../agents/agent.service.js';
import { diffFields, recordAudit } from '../audit/audit.service.js';
import { ClientLocation } from '../locations/location.model.js';
import { notify } from '../notifications/notification.service.js';
import { isTeamInScope, resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { User } from '../users/user.model.js';
import { Assignment, type AssignmentDoc } from './assignment.model.js';
import type {
  AssignmentDto,
  ChangeAssignmentStatusBody,
  CreateAssignmentBody,
  ListAssignmentsQuery,
  ListMyAssignmentsQuery,
  UpdateAssignmentBody,
} from './assignment.schemas.js';
import { EDITABLE_STATUSES, canTransition } from './assignment.transitions.js';

type AgentSummary = { id: string; name: string };
type LocationSummary = NonNullable<AssignmentDto['location']>;

function toAssignmentDto(
  doc: AssignmentDoc,
  agents: Map<string, AgentSummary>,
  locations: Map<string, LocationSummary>,
): AssignmentDto {
  return {
    id: idString(doc._id),
    agentId: idString(doc.agentId),
    teamId: doc.teamId ? idString(doc.teamId) : null,
    locationId: idString(doc.locationId),
    agent: agents.get(idString(doc.agentId)) ?? null,
    location: locations.get(idString(doc.locationId)) ?? null,
    scheduledDate: doc.scheduledDate,
    window: doc.window
      ? { start: doc.window.start.toISOString(), end: doc.window.end.toISOString() }
      : null,
    deadline: isoOrNull(doc.deadline),
    priority: doc.priority,
    status: doc.status,
    title: doc.title,
    notes: doc.notes,
    routeId: doc.routeId ? idString(doc.routeId) : null,
    statusHistory: doc.statusHistory.map((change) => ({
      status: change.status,
      at: change.at.toISOString(),
      by: change.by ? idString(change.by) : null,
      reason: change.reason,
    })),
    createdBy: idString(doc.createdBy),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Batch-loads agent names and location summaries for a page of assignments (2–3 queries). */
export async function toAssignmentDtos(
  actor: Pick<Actor, 'orgId'>,
  docs: AssignmentDoc[],
): Promise<AssignmentDto[]> {
  const agentIds = [...new Set(docs.map((d) => idString(d.agentId)))];
  const locationIds = [...new Set(docs.map((d) => idString(d.locationId)))];

  const [profiles, locationDocs] = await Promise.all([
    AgentProfile.find({ orgId: actor.orgId, _id: { $in: agentIds } })
      .select('userId')
      .lean(),
    ClientLocation.find({ orgId: actor.orgId, _id: { $in: locationIds } })
      .select('name address point')
      .lean(),
  ]);
  const users = await User.find({ orgId: actor.orgId, _id: { $in: profiles.map((p) => p.userId) } })
    .select('name')
    .lean();
  const userNames = new Map(users.map((u) => [idString(u._id), u.name]));

  const agents = new Map<string, AgentSummary>(
    profiles.map((p) => [
      idString(p._id),
      { id: idString(p._id), name: userNames.get(idString(p.userId)) ?? 'Unknown agent' },
    ]),
  );
  const locations = new Map<string, LocationSummary>(
    locationDocs.map((l) => [
      idString(l._id),
      {
        id: idString(l._id),
        name: l.name,
        address: l.address,
        position: toLatLng(l.point.coordinates),
      },
    ]),
  );
  return docs.map((doc) => toAssignmentDto(doc, agents, locations));
}

const toDto = async (actor: Pick<Actor, 'orgId'>, doc: AssignmentDoc) =>
  (await toAssignmentDtos(actor, [doc]))[0]!;

/** Builds the DTO and broadcasts `assignment:updated` to everyone allowed to see it. */
async function toDtoAndPublish(orgId: string, doc: AssignmentDoc): Promise<AssignmentDto> {
  const dto = await toDto({ orgId }, doc);
  publishAssignmentUpdated(orgId, dto);
  return dto;
}

/**
 * Status change made by the system (visit verified, deadline passed) rather than a user.
 * Only applies when the assignment is still in one of `from`; returns null otherwise.
 */
export async function systemTransition(
  orgId: string,
  assignmentId: Types.ObjectId | string,
  from: readonly AssignmentStatus[],
  to: AssignmentStatus,
  reason: string,
): Promise<AssignmentDto | null> {
  const updated = await Assignment.findOneAndUpdate(
    { _id: assignmentId, orgId, status: { $in: [...from] } },
    {
      $set: { status: to },
      $push: { statusHistory: { status: to, at: new Date(), by: null, reason } },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) return null;
  const dto = await toDtoAndPublish(orgId, updated);
  if (to === 'overdue') {
    const what = dto.title ?? dto.location?.name ?? 'Assignment';
    await notify(orgId, {
      kind: 'assignment_overdue',
      severity: dto.priority === 'urgent' || dto.priority === 'high' ? 'high' : 'medium',
      title: `Overdue: ${what}`,
      body: `${dto.agent?.name ?? 'The agent'} has not completed "${what}" (${dto.scheduledDate}). ${reason}.`,
      link: '/dashboard/tasks',
      entityType: 'assignment',
      entityId: updated._id,
      teamId: updated.teamId,
      event: 'assignment.overdue',
      data: dto,
    });
  }
  return dto;
}

/** The agent's open assignment at a location for a given day (used to link visits). */
export async function findOpenAssignmentFor(
  orgId: string,
  agentId: Types.ObjectId | string,
  locationId: Types.ObjectId | string,
  scheduledDate: string,
) {
  return Assignment.findOne({
    orgId,
    agentId,
    locationId,
    scheduledDate,
    status: { $in: ['pending', 'overdue', 'in_progress'] },
  })
    .sort({ 'window.start': 1, createdAt: 1 })
    .lean();
}

/** An active agent the caller may assign work to. Returns the agent's current team. */
async function resolveAssignableAgent(
  actor: Actor,
  agentId: string,
): Promise<Types.ObjectId | null> {
  const profile = await findAgentInScope(actor, agentId);
  const user = await User.findOne({ _id: profile.userId, orgId: actor.orgId })
    .select('status')
    .lean();
  if (!user || user.status !== 'active') throw badRequest('agentId refers to a deactivated agent');
  return profile.teamId;
}

async function assertAssignableLocation(actor: Actor, locationId: string): Promise<void> {
  const location = await ClientLocation.findOne({ _id: locationId, orgId: actor.orgId })
    .select('isArchived')
    .lean();
  if (!location) throw badRequest('locationId does not reference a location in your organization');
  if (location.isArchived) throw badRequest('Cannot assign work at an archived location');
}

function dateFilter(query: { date?: string; dateFrom?: string; dateTo?: string }) {
  if (query.date) return { scheduledDate: query.date };
  if (query.dateFrom || query.dateTo) {
    return {
      scheduledDate: {
        ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
        ...(query.dateTo ? { $lte: query.dateTo } : {}),
      },
    };
  }
  return {};
}

/** Loads an assignment the caller may access, or throws 404. */
async function findAssignmentInScope(actor: Actor, id: string) {
  const assignment = await Assignment.findOne({ _id: id, orgId: actor.orgId });
  if (!assignment) throw notFound('Assignment');
  if (actor.role === 'agent') {
    const own = await AgentProfile.exists({
      orgId: actor.orgId,
      userId: actor.userId,
      _id: assignment.agentId,
    });
    if (!own) throw notFound('Assignment');
  } else if (!isTeamInScope(await resolveTeamScope(actor), assignment.teamId)) {
    throw notFound('Assignment');
  }
  return assignment;
}

async function runListQuery(
  actor: Actor,
  filter: Record<string, unknown>,
  page: number,
  limit: number,
  sort: string,
) {
  const [docs, total] = await Promise.all([
    Assignment.find(filter).sort(toMongoSort(sort)).skip(skipFor(page, limit)).limit(limit).lean(),
    Assignment.countDocuments(filter),
  ]);
  return { data: await toAssignmentDtos(actor, docs), meta: pageMeta(page, limit, total) };
}

export async function listAssignments(actor: Actor, query: ListAssignmentsQuery) {
  const scope = await resolveTeamScope(actor);
  const conditions: Record<string, unknown>[] = [teamScopeFilter(scope), dateFilter(query)];
  if (query.teamId) conditions.push({ teamId: toObjectId(query.teamId) });
  if (query.agentId) conditions.push({ agentId: toObjectId(query.agentId) });
  if (query.locationId) conditions.push({ locationId: toObjectId(query.locationId) });
  if (query.status) conditions.push({ status: { $in: query.status } });
  if (query.priority) conditions.push({ priority: { $in: query.priority } });
  const filter = { orgId: toObjectId(actor.orgId), $and: conditions };
  return runListQuery(actor, filter, query.page, query.limit, query.sort);
}

export async function listMyAssignments(actor: Actor, query: ListMyAssignmentsQuery) {
  const profile = await AgentProfile.findOne({ orgId: actor.orgId, userId: actor.userId })
    .select('_id')
    .lean();
  if (!profile) throw notFound('Agent profile');
  const filter: Record<string, unknown> = {
    orgId: toObjectId(actor.orgId),
    agentId: profile._id,
    ...dateFilter(query),
  };
  if (query.status) filter.status = { $in: query.status };
  return runListQuery(actor, filter, query.page, query.limit, query.sort);
}

export async function getAssignment(actor: Actor, id: string): Promise<AssignmentDto> {
  return toDto(actor, (await findAssignmentInScope(actor, id)).toObject());
}

export async function createAssignment(
  actor: Actor,
  body: CreateAssignmentBody,
): Promise<AssignmentDto> {
  const teamId = await resolveAssignableAgent(actor, body.agentId);
  await assertAssignableLocation(actor, body.locationId);

  const now = new Date();
  const assignment = await Assignment.create({
    orgId: actor.orgId,
    agentId: body.agentId,
    teamId,
    locationId: body.locationId,
    scheduledDate: body.scheduledDate,
    window: body.window
      ? { start: new Date(body.window.start), end: new Date(body.window.end) }
      : null,
    deadline: body.deadline ? new Date(body.deadline) : null,
    priority: body.priority,
    title: body.title ?? null,
    notes: body.notes ?? null,
    statusHistory: [{ status: 'pending', at: now, by: actor.userId, reason: null }],
    createdBy: actor.userId,
  });
  await recordAudit(actor, {
    action: 'assignment.created',
    entityType: 'assignment',
    entityId: assignment._id,
    metadata: {
      agentId: body.agentId,
      locationId: body.locationId,
      scheduledDate: body.scheduledDate,
    },
  });
  return toDtoAndPublish(actor.orgId, assignment.toObject());
}

export async function updateAssignment(
  actor: Actor,
  id: string,
  body: UpdateAssignmentBody,
): Promise<AssignmentDto> {
  const assignment = await findAssignmentInScope(actor, id);
  if (!EDITABLE_STATUSES.includes(assignment.status)) {
    throw invalidTransition(`Assignments in status '${assignment.status}' cannot be edited`);
  }
  const before = assignment.toObject();

  if (body.agentId !== undefined && body.agentId !== idString(assignment.agentId)) {
    assignment.teamId = await resolveAssignableAgent(actor, body.agentId);
    assignment.agentId = toObjectId(body.agentId);
  }
  if (body.locationId !== undefined && body.locationId !== idString(assignment.locationId)) {
    await assertAssignableLocation(actor, body.locationId);
    assignment.locationId = toObjectId(body.locationId);
  }
  if (body.scheduledDate !== undefined) assignment.scheduledDate = body.scheduledDate;
  if (body.window !== undefined) {
    assignment.window = body.window
      ? { start: new Date(body.window.start), end: new Date(body.window.end) }
      : null;
  }
  if (body.deadline !== undefined)
    assignment.deadline = body.deadline ? new Date(body.deadline) : null;
  if (body.priority !== undefined) assignment.priority = body.priority;
  if (body.title !== undefined) assignment.title = body.title;
  if (body.notes !== undefined) assignment.notes = body.notes;
  await assignment.save();

  const changes = diffFields(before, assignment.toObject(), [
    'agentId',
    'teamId',
    'locationId',
    'scheduledDate',
    'window',
    'deadline',
    'priority',
    'title',
    'notes',
  ]);
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action: changes.agentId ? 'assignment.reassigned' : 'assignment.updated',
      entityType: 'assignment',
      entityId: assignment._id,
      changes,
    });
  }
  return toDtoAndPublish(actor.orgId, assignment.toObject());
}

export async function changeAssignmentStatus(
  actor: Actor,
  id: string,
  body: ChangeAssignmentStatusBody,
): Promise<AssignmentDto> {
  const assignment = await findAssignmentInScope(actor, id);
  const from = assignment.status;
  if (!canTransition(from, body.status, actor.role)) {
    throw invalidTransition(`Cannot change status from '${from}' to '${body.status}'`, {
      from,
      to: body.status,
    });
  }
  // Conditional update guards against two concurrent transitions from the same state.
  const updated = await Assignment.findOneAndUpdate(
    { _id: assignment._id, orgId: actor.orgId, status: from },
    {
      $set: { status: body.status },
      $push: {
        statusHistory: {
          status: body.status,
          at: new Date(),
          by: actor.userId,
          reason: body.reason ?? null,
        },
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw invalidTransition('Assignment status changed concurrently; reload and retry');

  await recordAudit(actor, {
    action: 'assignment.status_changed',
    entityType: 'assignment',
    entityId: assignment._id,
    changes: { status: { from, to: body.status } },
    metadata: body.reason ? { reason: body.reason } : null,
  });
  return toDtoAndPublish(actor.orgId, updated);
}
