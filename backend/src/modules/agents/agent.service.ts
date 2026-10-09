import type { PipelineStage, Types } from 'mongoose';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { escapeRegex, pageMeta, skipFor } from '../../lib/pagination.js';
import { idString, isoOrNull, toLatLng, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { diffFields, recordAudit } from '../audit/audit.service.js';
import { hashPassword } from '../auth/password.js';
import { Team } from '../teams/team.model.js';
import { isTeamInScope, resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { User, type UserDoc } from '../users/user.model.js';
import { assertEmailAvailable, resetUserPassword, setUserStatus } from '../users/user.service.js';
import { AgentProfile, type AgentProfileDoc } from './agent.model.js';
import type {
  AgentDto,
  CreateAgentBody,
  ListAgentsQuery,
  UpdateAgentBody,
} from './agent.schemas.js';

type AgentUserFields = Pick<UserDoc, 'name' | 'email' | 'status' | 'mustChangePassword'>;

export function toAgentDto(profile: AgentProfileDoc, user: AgentUserFields): AgentDto {
  return {
    id: idString(profile._id),
    userId: idString(profile.userId),
    name: user.name,
    email: user.email,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    teamId: profile.teamId ? idString(profile.teamId) : null,
    employeeCode: profile.employeeCode,
    phone: profile.phone,
    vehicle: { type: profile.vehicle.type, plate: profile.vehicle.plate },
    shiftStatus: profile.shiftStatus,
    lastLocation: profile.lastLocation
      ? {
          position: toLatLng(profile.lastLocation.point.coordinates),
          accuracyM: profile.lastLocation.accuracyM,
          recordedAt: profile.lastLocation.recordedAt.toISOString(),
        }
      : null,
    lastSeenAt: isoOrNull(profile.lastSeenAt),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

const USER_PROJECTION = 'name email status mustChangePassword';

async function loadAgentUser(actor: Actor, userId: Types.ObjectId): Promise<AgentUserFields> {
  const user = await User.findOne({ _id: userId, orgId: actor.orgId })
    .select(USER_PROJECTION)
    .lean();
  if (!user) throw notFound('Agent');
  return user;
}

/** Validates a target team for an agent: same org, not archived, within caller's scope. */
async function assertAssignableTeam(actor: Actor, teamId: string | null): Promise<void> {
  if (teamId === null) {
    if (actor.role !== 'admin') throw forbidden('Managers must place agents in one of their teams');
    return;
  }
  const team = await Team.findOne({ _id: teamId, orgId: actor.orgId }).select('isArchived').lean();
  const scope = await resolveTeamScope(actor);
  if (!team || !isTeamInScope(scope, team._id))
    throw badRequest('teamId does not reference a team you manage');
  if (team.isArchived) throw badRequest('Cannot add agents to an archived team');
}

async function assertEmployeeCodeAvailable(actor: Actor, code: string, exceptId?: Types.ObjectId) {
  const existing = await AgentProfile.exists({
    orgId: actor.orgId,
    employeeCode: code,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (existing) throw conflict('Another agent already uses this employee code');
}

/** Loads an agent profile the caller may access, or throws 404 (never 403, to avoid probing). */
export async function findAgentInScope(actor: Actor, id: string) {
  const profile = await AgentProfile.findOne({ _id: id, orgId: actor.orgId });
  if (!profile) throw notFound('Agent');
  if (actor.role === 'agent') {
    if (idString(profile.userId) !== actor.userId) throw notFound('Agent');
    return profile;
  }
  const scope = await resolveTeamScope(actor);
  if (!isTeamInScope(scope, profile.teamId)) throw notFound('Agent');
  return profile;
}

export async function listAgents(actor: Actor, query: ListAgentsQuery) {
  const scope = await resolveTeamScope(actor);
  const profileConditions: Record<string, unknown>[] = [teamScopeFilter(scope)];
  if (query.teamId) profileConditions.push({ teamId: toObjectId(query.teamId) });
  if (query.shiftStatus) profileConditions.push({ shiftStatus: { $in: query.shiftStatus } });

  const userConditions: Record<string, unknown>[] = [];
  if (query.status) userConditions.push({ 'user.status': { $in: query.status } });
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    userConditions.push({
      $or: [{ 'user.name': pattern }, { 'user.email': pattern }, { employeeCode: pattern }],
    });
  }

  const sortField = query.sort.replace(/^-/, '');
  const direction = query.sort.startsWith('-') ? -1 : 1;
  const sortKey = sortField === 'name' ? 'user.name' : sortField;

  const pipeline: PipelineStage[] = [
    { $match: { orgId: toObjectId(actor.orgId), $and: profileConditions } },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { name: 1, email: 1, status: 1, mustChangePassword: 1 } }],
      },
    },
    { $unwind: '$user' },
    ...(userConditions.length > 0 ? [{ $match: { $and: userConditions } }] : []),
    { $sort: { [sortKey]: direction, _id: direction } },
    {
      $facet: {
        data: [{ $skip: skipFor(query.page, query.limit) }, { $limit: query.limit }],
        total: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await AgentProfile.aggregate<{
    data: (AgentProfileDoc & { user: AgentUserFields })[];
    total: { count: number }[];
  }>(pipeline);
  const rows = result?.data ?? [];
  const total = result?.total[0]?.count ?? 0;
  return {
    data: rows.map((row) => toAgentDto(row, row.user)),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function getAgent(actor: Actor, id: string): Promise<AgentDto> {
  const profile = await findAgentInScope(actor, id);
  return toAgentDto(profile.toObject(), await loadAgentUser(actor, profile.userId));
}

export async function getOwnAgentProfile(actor: Actor): Promise<AgentDto> {
  const profile = await AgentProfile.findOne({ orgId: actor.orgId, userId: actor.userId }).lean();
  if (!profile) throw notFound('Agent profile');
  return toAgentDto(profile, await loadAgentUser(actor, profile.userId));
}

export async function createAgent(actor: Actor, body: CreateAgentBody): Promise<AgentDto> {
  const teamId = body.teamId ?? null;
  await assertAssignableTeam(actor, teamId);
  await assertEmailAvailable(body.email);
  if (body.employeeCode) await assertEmployeeCodeAvailable(actor, body.employeeCode);

  const user = await User.create({
    orgId: actor.orgId,
    name: body.name,
    email: body.email,
    role: 'agent',
    passwordHash: await hashPassword(body.temporaryPassword),
    mustChangePassword: true,
  });

  let profile;
  try {
    profile = await AgentProfile.create({
      orgId: actor.orgId,
      userId: user._id,
      teamId,
      employeeCode: body.employeeCode ?? null,
      phone: body.phone ?? null,
      vehicle: body.vehicle ?? { type: 'none', plate: null },
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id, orgId: actor.orgId });
    throw error;
  }

  await recordAudit(actor, {
    action: 'agent.created',
    entityType: 'agent',
    entityId: profile._id,
    metadata: { userId: user._id.toString(), email: user.email, teamId },
  });
  return toAgentDto(profile.toObject(), user.toObject());
}

export async function updateAgent(
  actor: Actor,
  id: string,
  body: UpdateAgentBody,
): Promise<AgentDto> {
  const profile = await findAgentInScope(actor, id);
  const before = profile.toObject();

  if (body.teamId !== undefined && String(body.teamId) !== String(profile.teamId)) {
    await assertAssignableTeam(actor, body.teamId);
    profile.teamId = body.teamId === null ? null : toObjectId(body.teamId);
  }
  if (body.employeeCode !== undefined && body.employeeCode !== profile.employeeCode) {
    if (body.employeeCode) await assertEmployeeCodeAvailable(actor, body.employeeCode, profile._id);
    profile.employeeCode = body.employeeCode;
  }
  if (body.phone !== undefined) profile.phone = body.phone;
  if (body.vehicle !== undefined) profile.vehicle = body.vehicle;
  await profile.save();

  const user = await User.findOne({ _id: profile.userId, orgId: actor.orgId });
  if (!user) throw notFound('Agent');
  const beforeName = user.name;
  if (body.name !== undefined && body.name !== user.name) {
    user.name = body.name;
    await user.save();
  }

  const changes = {
    ...diffFields(before, profile.toObject(), ['teamId', 'employeeCode', 'phone', 'vehicle']),
    ...diffFields({ name: beforeName }, { name: user.name }, ['name']),
  };
  if (Object.keys(changes).length > 0) {
    await recordAudit(actor, {
      action: changes.teamId ? 'agent.team_changed' : 'agent.updated',
      entityType: 'agent',
      entityId: profile._id,
      changes,
    });
  }
  return toAgentDto(profile.toObject(), user.toObject());
}

export async function setAgentStatus(
  actor: Actor,
  id: string,
  status: 'active' | 'deactivated',
): Promise<AgentDto> {
  const profile = await findAgentInScope(actor, id);
  await setUserStatus(actor, idString(profile.userId), status);
  if (status === 'deactivated' && profile.shiftStatus !== 'off_shift') {
    profile.shiftStatus = 'off_shift';
    await profile.save();
  }
  return toAgentDto(profile.toObject(), await loadAgentUser(actor, profile.userId));
}

export async function resetAgentPassword(actor: Actor, id: string, temporaryPassword: string) {
  const profile = await findAgentInScope(actor, id);
  await resetUserPassword(actor, idString(profile.userId), temporaryPassword);
}
