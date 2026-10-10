import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { escapeRegex, pageMeta, skipFor, toMongoSort } from '../../lib/pagination.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { diffFields, recordAudit } from '../audit/audit.service.js';
import { User } from '../users/user.model.js';
import { Team, type TeamDoc } from './team.model.js';
import type { CreateTeamBody, ListTeamsQuery, TeamDto, UpdateTeamBody } from './team.schemas.js';
import { isTeamInScope, resolveTeamScope } from './team.scope.js';

export function toTeamDto(doc: TeamDoc): TeamDto {
  return {
    id: idString(doc._id),
    name: doc.name,
    description: doc.description,
    managerIds: doc.managerIds.map(idString),
    isArchived: doc.isArchived,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function assertValidManagers(actor: Actor, managerIds: string[]): Promise<void> {
  if (managerIds.length === 0) return;
  const count = await User.countDocuments({
    orgId: actor.orgId,
    _id: { $in: managerIds },
    role: { $in: ['manager', 'admin'] },
    status: 'active',
  });
  if (count !== managerIds.length) {
    throw badRequest('managerIds must reference active managers or admins in your organization');
  }
}

async function assertNameAvailable(actor: Actor, name: string, exceptId?: string): Promise<void> {
  const existing = await Team.findOne({
    orgId: actor.orgId,
    name,
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  })
    .collation({ locale: 'en', strength: 2 })
    .select('_id')
    .lean();
  if (existing) throw conflict('A team with this name already exists');
}

/** Loads a team the caller is allowed to see, or throws 404. */
export async function findTeamInScope(actor: Actor, id: string) {
  const team = await Team.findOne({ _id: id, orgId: actor.orgId });
  if (!team) throw notFound('Team');
  const scope = await resolveTeamScope(actor);
  if (!isTeamInScope(scope, team._id)) throw notFound('Team');
  return team;
}

export async function listTeams(actor: Actor, query: ListTeamsQuery) {
  const scope = await resolveTeamScope(actor);
  const filter: Record<string, unknown> = { orgId: toObjectId(actor.orgId) };
  if (scope !== 'all') filter._id = { $in: scope };
  if (!query.includeArchived) filter.isArchived = false;
  if (query.q) filter.name = new RegExp(escapeRegex(query.q), 'i');

  const [docs, total] = await Promise.all([
    Team.find(filter)
      .collation({ locale: 'en', strength: 2 })
      .sort(toMongoSort(query.sort))
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    Team.countDocuments(filter),
  ]);
  return { data: docs.map(toTeamDto), meta: pageMeta(query.page, query.limit, total) };
}

export async function getTeam(actor: Actor, id: string): Promise<TeamDto> {
  return toTeamDto((await findTeamInScope(actor, id)).toObject());
}

export async function createTeam(actor: Actor, body: CreateTeamBody): Promise<TeamDto> {
  await assertNameAvailable(actor, body.name);
  await assertValidManagers(actor, body.managerIds);
  const team = await Team.create({
    orgId: actor.orgId,
    name: body.name,
    description: body.description ?? null,
    managerIds: body.managerIds,
  });
  await recordAudit(actor, {
    action: 'team.created',
    entityType: 'team',
    entityId: team._id,
    metadata: { name: team.name, managerIds: body.managerIds },
  });
  return toTeamDto(team.toObject());
}

export async function updateTeam(actor: Actor, id: string, body: UpdateTeamBody): Promise<TeamDto> {
  const team = await findTeamInScope(actor, id);
  const before = team.toObject();
  if (body.name !== undefined && body.name !== team.name) {
    await assertNameAvailable(actor, body.name, id);
    team.name = body.name;
  }
  if (body.description !== undefined) team.description = body.description;
  if (body.managerIds !== undefined) {
    await assertValidManagers(actor, body.managerIds);
    team.set('managerIds', body.managerIds);
  }
  await team.save();
  await recordAudit(actor, {
    action: 'team.updated',
    entityType: 'team',
    entityId: team._id,
    changes: diffFields(before, team.toObject(), ['name', 'description', 'managerIds']),
  });
  return toTeamDto(team.toObject());
}

export async function setTeamArchived(
  actor: Actor,
  id: string,
  isArchived: boolean,
): Promise<TeamDto> {
  const team = await findTeamInScope(actor, id);
  if (team.isArchived !== isArchived) {
    team.isArchived = isArchived;
    await team.save();
    await recordAudit(actor, {
      action: isArchived ? 'team.archived' : 'team.unarchived',
      entityType: 'team',
      entityId: team._id,
      changes: { isArchived: { from: !isArchived, to: isArchived } },
    });
  }
  return toTeamDto(team.toObject());
}
