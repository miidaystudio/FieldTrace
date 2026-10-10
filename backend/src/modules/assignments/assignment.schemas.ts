import { paginationQuery, sortQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import { ASSIGNMENT_PRIORITIES, ASSIGNMENT_STATUSES } from '../../shared/enums.js';
import {
  csvEnum,
  dateOnly,
  isoDateTime,
  latLngSchema,
  objectIdSchema,
  text,
} from '../../shared/schemas.js';

const timeWindow = z
  .object({ start: isoDateTime, end: isoDateTime })
  .refine((w) => new Date(w.start) < new Date(w.end), {
    message: 'window.start must be before window.end',
    path: ['end'],
  })
  .openapi('TimeWindow', { description: 'Expected arrival window (absolute UTC instants).' });

export const assignmentDto = z
  .object({
    id: objectIdSchema,
    agentId: objectIdSchema,
    teamId: objectIdSchema.nullable(),
    locationId: objectIdSchema,
    /** Light summaries so list views don't need N extra requests. */
    agent: z.object({ id: objectIdSchema, name: z.string() }).nullable(),
    location: z
      .object({
        id: objectIdSchema,
        name: z.string(),
        address: z.string().nullable(),
        position: latLngSchema,
      })
      .nullable(),
    scheduledDate: dateOnly,
    window: z.object({ start: isoDateTime, end: isoDateTime }).nullable(),
    deadline: isoDateTime.nullable(),
    priority: z.enum(ASSIGNMENT_PRIORITIES),
    status: z.enum(ASSIGNMENT_STATUSES),
    title: z.string().nullable(),
    notes: z.string().nullable(),
    routeId: objectIdSchema.nullable(),
    statusHistory: z.array(
      z.object({
        status: z.enum(ASSIGNMENT_STATUSES),
        at: isoDateTime,
        /** null = changed by the system (visit verified, deadline passed). */
        by: objectIdSchema.nullable(),
        reason: z.string().nullable(),
      }),
    ),
    createdBy: objectIdSchema,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('Assignment');
export type AssignmentDto = z.infer<typeof assignmentDto>;

export const createAssignmentBody = z
  .object({
    agentId: objectIdSchema,
    locationId: objectIdSchema,
    scheduledDate: dateOnly.openapi({ description: "Day in the organization's timezone." }),
    window: timeWindow.nullable().optional(),
    deadline: isoDateTime.nullable().optional(),
    priority: z.enum(ASSIGNMENT_PRIORITIES).default('normal'),
    title: text(120).nullable().optional(),
    notes: text(2000).nullable().optional(),
  })
  .strict()
  .openapi('CreateAssignmentRequest');
export type CreateAssignmentBody = z.infer<typeof createAssignmentBody>;

export const updateAssignmentBody = z
  .object({
    agentId: objectIdSchema.optional(),
    locationId: objectIdSchema.optional(),
    scheduledDate: dateOnly.optional(),
    window: timeWindow.nullable().optional(),
    deadline: isoDateTime.nullable().optional(),
    priority: z.enum(ASSIGNMENT_PRIORITIES).optional(),
    title: text(120).nullable().optional(),
    notes: text(2000).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'at least one field is required')
  .openapi('UpdateAssignmentRequest');
export type UpdateAssignmentBody = z.infer<typeof updateAssignmentBody>;

export const changeAssignmentStatusBody = z
  .object({
    status: z.enum(['in_progress', 'completed', 'cancelled']),
    reason: text(500).nullable().optional(),
  })
  .strict()
  .refine((body) => body.status !== 'cancelled' || Boolean(body.reason), {
    message: 'reason is required when cancelling',
    path: ['reason'],
  })
  .openapi('ChangeAssignmentStatusRequest');
export type ChangeAssignmentStatusBody = z.infer<typeof changeAssignmentStatusBody>;

const dateRangeFields = {
  date: dateOnly.optional(),
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
};

export const listAssignmentsQuery = paginationQuery.extend({
  ...dateRangeFields,
  agentId: objectIdSchema.optional(),
  teamId: objectIdSchema.optional(),
  locationId: objectIdSchema.optional(),
  status: csvEnum(ASSIGNMENT_STATUSES),
  priority: csvEnum(ASSIGNMENT_PRIORITIES),
  sort: sortQuery(['scheduledDate', 'deadline', 'createdAt'], 'scheduledDate'),
});
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuery>;

export const listMyAssignmentsQuery = paginationQuery.extend({
  ...dateRangeFields,
  status: csvEnum(ASSIGNMENT_STATUSES),
  sort: sortQuery(['scheduledDate', 'deadline', 'createdAt'], 'scheduledDate'),
});
export type ListMyAssignmentsQuery = z.infer<typeof listMyAssignmentsQuery>;
