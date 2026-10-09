import { createModuleRouter } from '../../lib/route.js';
import { organizationDto, updateOrganizationBody } from './organization.schemas.js';
import { getOrganization, updateOrganization } from './organization.service.js';

export const organizationRoutes = createModuleRouter({
  basePath: '/organization',
  tag: 'Organization & Settings',
});

organizationRoutes.route({
  method: 'get',
  path: '/',
  summary: "Get the caller's organization and its settings",
  auth: ['admin', 'manager', 'agent'],
  response: organizationDto,
  handler: async ({ actor }) => ({ data: await getOrganization(actor) }),
});

organizationRoutes.route({
  method: 'patch',
  path: '/',
  summary: 'Update organization profile and settings',
  description: 'Settings are merged per top-level key; nested objects are replaced as a whole.',
  auth: ['admin'],
  body: updateOrganizationBody,
  response: organizationDto,
  handler: async ({ actor, body }) => ({ data: await updateOrganization(actor, body) }),
});
