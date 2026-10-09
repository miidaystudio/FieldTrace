import { createModuleRouter } from '../../lib/route.js';
import { idParams } from '../../shared/schemas.js';
import {
  assignmentDto,
  changeAssignmentStatusBody,
  createAssignmentBody,
  listAssignmentsQuery,
  listMyAssignmentsQuery,
  updateAssignmentBody,
} from './assignment.schemas.js';
import {
  changeAssignmentStatus,
  createAssignment,
  getAssignment,
  listAssignments,
  listMyAssignments,
  updateAssignment,
} from './assignment.service.js';

export const assignmentRoutes = createModuleRouter({
  basePath: '/assignments',
  tag: 'Assignments',
});

// Registered before `/:id` so `mine` is not parsed as an id.
assignmentRoutes.route({
  method: 'get',
  path: '/mine',
  summary: "The calling agent's assignments (driver app)",
  auth: ['agent'],
  query: listMyAssignmentsQuery,
  response: assignmentDto,
  list: true,
  handler: ({ actor, query }) => listMyAssignments(actor, query),
});

assignmentRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List assignments',
  description:
    'Admins see all; managers see assignments of their teams. Filter a single day with `date` ' +
    'or a range with `dateFrom`/`dateTo` (inclusive, `YYYY-MM-DD`).',
  auth: ['admin', 'manager'],
  query: listAssignmentsQuery,
  response: assignmentDto,
  list: true,
  handler: ({ actor, query }) => listAssignments(actor, query),
});

assignmentRoutes.route({
  method: 'post',
  path: '/',
  summary: 'Assign a client location visit to an agent',
  auth: ['admin', 'manager'],
  body: createAssignmentBody,
  status: 201,
  response: assignmentDto,
  handler: async ({ actor, body }) => ({ data: await createAssignment(actor, body) }),
});

assignmentRoutes.route({
  method: 'get',
  path: '/:id',
  summary: 'Get an assignment',
  description: 'Agents may read only their own assignments.',
  auth: ['admin', 'manager', 'agent'],
  params: idParams,
  response: assignmentDto,
  handler: async ({ actor, params }) => ({ data: await getAssignment(actor, params.id) }),
});

assignmentRoutes.route({
  method: 'patch',
  path: '/:id',
  summary: 'Edit or reassign an assignment (only while pending/overdue)',
  auth: ['admin', 'manager'],
  params: idParams,
  body: updateAssignmentBody,
  response: assignmentDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({
    data: await updateAssignment(actor, params.id, body),
  }),
});

assignmentRoutes.route({
  method: 'post',
  path: '/:id/status',
  summary: 'Change assignment status',
  description:
    'Allowed: pending|overdue → in_progress|completed|cancelled; in_progress → completed|cancelled. ' +
    'Agents may only move their own assignments to in_progress/completed. `reason` is required ' +
    'for cancellation. Invalid transitions return `409 INVALID_STATE_TRANSITION`.',
  auth: ['admin', 'manager', 'agent'],
  params: idParams,
  body: changeAssignmentStatusBody,
  response: assignmentDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({
    data: await changeAssignmentStatus(actor, params.id, body),
  }),
});
