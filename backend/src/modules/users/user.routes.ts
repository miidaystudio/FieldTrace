import { createModuleRouter } from '../../lib/route.js';
import { idParams } from '../../shared/schemas.js';
import {
  createUserBody,
  listUsersQuery,
  resetPasswordBody,
  updateUserBody,
  userDto,
} from './user.schemas.js';
import {
  createUser,
  getUser,
  listUsers,
  resetUserPassword,
  setUserStatus,
  updateUser,
} from './user.service.js';

export const userRoutes = createModuleRouter({ basePath: '/users', tag: 'Team & Roles' });

userRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List user accounts in the organization (all roles)',
  auth: ['admin'],
  query: listUsersQuery,
  response: userDto,
  list: true,
  handler: ({ actor, query }) => listUsers(actor, query),
});

userRoutes.route({
  method: 'post',
  path: '/',
  summary: 'Create a staff account (admin or manager) with a temporary password',
  description:
    'The new user must change the temporary password at first login. Field agents are created ' +
    'via `POST /agents`.',
  auth: ['admin'],
  body: createUserBody,
  status: 201,
  response: userDto,
  errors: [409],
  handler: async ({ actor, body }) => ({ data: await createUser(actor, body) }),
});

userRoutes.route({
  method: 'get',
  path: '/:id',
  summary: 'Get a user account',
  auth: ['admin'],
  params: idParams,
  response: userDto,
  handler: async ({ actor, params }) => ({ data: await getUser(actor, params.id) }),
});

userRoutes.route({
  method: 'patch',
  path: '/:id',
  summary: 'Update name and/or role (admin ↔ manager)',
  auth: ['admin'],
  params: idParams,
  body: updateUserBody,
  response: userDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({ data: await updateUser(actor, params.id, body) }),
});

userRoutes.route({
  method: 'post',
  path: '/:id/deactivate',
  summary: 'Deactivate an account and revoke all of its sessions',
  auth: ['admin'],
  params: idParams,
  response: userDto,
  errors: [409],
  handler: async ({ actor, params }) => ({
    data: await setUserStatus(actor, params.id, 'deactivated'),
  }),
});

userRoutes.route({
  method: 'post',
  path: '/:id/reactivate',
  summary: 'Reactivate a deactivated account',
  auth: ['admin'],
  params: idParams,
  response: userDto,
  handler: async ({ actor, params }) => ({ data: await setUserStatus(actor, params.id, 'active') }),
});

userRoutes.route({
  method: 'post',
  path: '/:id/reset-password',
  summary: 'Issue a new temporary password (forces change at next login, revokes sessions)',
  auth: ['admin'],
  params: idParams,
  body: resetPasswordBody,
  handler: async ({ actor, params, body }) => {
    await resetUserPassword(actor, params.id, body.temporaryPassword);
  },
});
