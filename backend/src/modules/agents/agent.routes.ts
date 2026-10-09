import { createModuleRouter } from '../../lib/route.js';
import { idParams } from '../../shared/schemas.js';
import { resetPasswordBody } from '../users/user.schemas.js';
import { agentDto, createAgentBody, listAgentsQuery, updateAgentBody } from './agent.schemas.js';
import {
  createAgent,
  getAgent,
  getOwnAgentProfile,
  listAgents,
  resetAgentPassword,
  setAgentStatus,
  updateAgent,
} from './agent.service.js';

export const agentRoutes = createModuleRouter({ basePath: '/agents', tag: 'Field Agents' });

// Registered before `/:id` so `me` is not parsed as an id.
agentRoutes.route({
  method: 'get',
  path: '/me',
  summary: "The calling agent's own profile (driver app)",
  auth: ['agent'],
  response: agentDto,
  handler: async ({ actor }) => ({ data: await getOwnAgentProfile(actor) }),
});

agentRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List field agents',
  description: 'Admins see all agents; managers see agents in the teams they manage.',
  auth: ['admin', 'manager'],
  query: listAgentsQuery,
  response: agentDto,
  list: true,
  handler: ({ actor, query }) => listAgents(actor, query),
});

agentRoutes.route({
  method: 'post',
  path: '/',
  summary: 'Create a field agent (login account + agent profile)',
  description:
    'Creates a user with role `agent` and a temporary password the agent must change at first ' +
    'login. Managers must specify one of their own teams.',
  auth: ['admin', 'manager'],
  body: createAgentBody,
  status: 201,
  response: agentDto,
  errors: [409],
  handler: async ({ actor, body }) => ({ data: await createAgent(actor, body) }),
});

agentRoutes.route({
  method: 'get',
  path: '/:id',
  summary: 'Get a field agent',
  auth: ['admin', 'manager'],
  params: idParams,
  response: agentDto,
  handler: async ({ actor, params }) => ({ data: await getAgent(actor, params.id) }),
});

agentRoutes.route({
  method: 'patch',
  path: '/:id',
  summary: 'Update agent details or move them to another team',
  auth: ['admin', 'manager'],
  params: idParams,
  body: updateAgentBody,
  response: agentDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({ data: await updateAgent(actor, params.id, body) }),
});

agentRoutes.route({
  method: 'post',
  path: '/:id/deactivate',
  summary: 'Deactivate an agent (revokes sessions, sets shift to off_shift)',
  auth: ['admin', 'manager'],
  params: idParams,
  response: agentDto,
  handler: async ({ actor, params }) => ({
    data: await setAgentStatus(actor, params.id, 'deactivated'),
  }),
});

agentRoutes.route({
  method: 'post',
  path: '/:id/reactivate',
  summary: 'Reactivate an agent',
  auth: ['admin', 'manager'],
  params: idParams,
  response: agentDto,
  handler: async ({ actor, params }) => ({
    data: await setAgentStatus(actor, params.id, 'active'),
  }),
});

agentRoutes.route({
  method: 'post',
  path: '/:id/reset-password',
  summary: 'Issue a new temporary password for an agent',
  auth: ['admin', 'manager'],
  params: idParams,
  body: resetPasswordBody,
  handler: async ({ actor, params, body }) => {
    await resetAgentPassword(actor, params.id, body.temporaryPassword);
  },
});
