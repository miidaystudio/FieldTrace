import type { Types } from 'mongoose';
import type { Actor } from '../../shared/types.js';
import { Team } from './team.model.js';

/**
 * Which teams the caller may see/act on.
 * - admin   -> 'all'
 * - manager -> the teams listing them in `managerIds` (archived included, for history)
 * - agent   -> none (agents only access their own data through `/me` routes)
 */
export type TeamScope = 'all' | Types.ObjectId[];

export async function resolveTeamScope(actor: Actor): Promise<TeamScope> {
  if (actor.role === 'admin') return 'all';
  if (actor.role === 'agent') return [];
  const teams = await Team.find({ orgId: actor.orgId, managerIds: actor.userId })
    .select('_id')
    .lean();
  return teams.map((team) => team._id);
}

export function isTeamInScope(scope: TeamScope, teamId: Types.ObjectId | string | null): boolean {
  if (scope === 'all') return true;
  if (teamId === null) return false;
  const id = teamId.toString();
  return scope.some((scoped) => scoped.toString() === id);
}

/** Mongo filter fragment restricting a `teamId` field to the scope. */
export function teamScopeFilter(scope: TeamScope, field = 'teamId'): Record<string, unknown> {
  return scope === 'all' ? {} : { [field]: { $in: scope } };
}
