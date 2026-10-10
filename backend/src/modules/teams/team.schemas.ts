import { paginationQuery, sortQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import { isoDateTime, objectIdSchema, queryBoolean, text } from '../../shared/schemas.js';

export const teamDto = z
  .object({
    id: objectIdSchema,
    name: z.string(),
    description: z.string().nullable(),
    managerIds: z.array(objectIdSchema),
    isArchived: z.boolean(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('Team');
export type TeamDto = z.infer<typeof teamDto>;

const managerIds = z
  .array(objectIdSchema)
  .max(20)
  .transform((ids) => [...new Set(ids)])
  .openapi({ description: 'Users with role manager or admin who supervise this team.' });

export const createTeamBody = z
  .object({
    name: text(80).openapi({ example: 'North Zone' }),
    description: text(500).nullable().optional(),
    managerIds: managerIds.default([]),
  })
  .strict()
  .openapi('CreateTeamRequest');
export type CreateTeamBody = z.infer<typeof createTeamBody>;

export const updateTeamBody = z
  .object({
    name: text(80).optional(),
    description: text(500).nullable().optional(),
    managerIds: managerIds.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'at least one field is required')
  .openapi('UpdateTeamRequest');
export type UpdateTeamBody = z.infer<typeof updateTeamBody>;

export const listTeamsQuery = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  includeArchived: queryBoolean.default(false),
  sort: sortQuery(['name', 'createdAt'], 'name'),
});
export type ListTeamsQuery = z.infer<typeof listTeamsQuery>;
