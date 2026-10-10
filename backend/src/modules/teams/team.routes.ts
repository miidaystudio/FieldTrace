import { createModuleRouter } from '../../lib/route.js';
import { idParams } from '../../shared/schemas.js';
import { createTeamBody, listTeamsQuery, teamDto, updateTeamBody } from './team.schemas.js';
import { createTeam, getTeam, listTeams, setTeamArchived, updateTeam } from './team.service.js';

export const teamRoutes = createModuleRouter({ basePath: '/teams', tag: 'Teams' });

teamRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List teams',
  description: 'Admins see all teams; managers see only the teams they manage.',
  auth: ['admin', 'manager'],
  query: listTeamsQuery,
  response: teamDto,
  list: true,
  handler: ({ actor, query }) => listTeams(actor, query),
});

teamRoutes.route({
  method: 'post',
  path: '/',
  summary: 'Create a team',
  auth: ['admin'],
  body: createTeamBody,
  status: 201,
  response: teamDto,
  errors: [409],
  handler: async ({ actor, body }) => ({ data: await createTeam(actor, body) }),
});

teamRoutes.route({
  method: 'get',
  path: '/:id',
  summary: 'Get a team',
  auth: ['admin', 'manager'],
  params: idParams,
  response: teamDto,
  handler: async ({ actor, params }) => ({ data: await getTeam(actor, params.id) }),
});

teamRoutes.route({
  method: 'patch',
  path: '/:id',
  summary: 'Update team name, description or managers',
  auth: ['admin'],
  params: idParams,
  body: updateTeamBody,
  response: teamDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({ data: await updateTeam(actor, params.id, body) }),
});

teamRoutes.route({
  method: 'post',
  path: '/:id/archive',
  summary: 'Archive a team (agents keep their membership; no new agents can join)',
  auth: ['admin'],
  params: idParams,
  response: teamDto,
  handler: async ({ actor, params }) => ({ data: await setTeamArchived(actor, params.id, true) }),
});

teamRoutes.route({
  method: 'post',
  path: '/:id/unarchive',
  summary: 'Restore an archived team',
  auth: ['admin'],
  params: idParams,
  response: teamDto,
  handler: async ({ actor, params }) => ({ data: await setTeamArchived(actor, params.id, false) }),
});
