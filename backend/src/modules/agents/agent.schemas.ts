import { paginationQuery, sortQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import { SHIFT_STATUSES, USER_STATUSES, VEHICLE_TYPES } from '../../shared/enums.js';
import { csvEnum, isoDateTime, latLngSchema, objectIdSchema, text } from '../../shared/schemas.js';
import { passwordSchema } from '../auth/password.js';
import { emailSchema } from '../users/user.schemas.js';

const vehicleSchema = z
  .object({
    type: z.enum(VEHICLE_TYPES),
    plate: text(20).nullable(),
  })
  .openapi('Vehicle');

export const agentDto = z
  .object({
    /** AgentProfile id — this is the `agentId` used everywhere else in the API. */
    id: objectIdSchema,
    userId: objectIdSchema,
    name: z.string(),
    email: z.string(),
    status: z.enum(USER_STATUSES),
    mustChangePassword: z.boolean(),
    teamId: objectIdSchema.nullable(),
    employeeCode: z.string().nullable(),
    phone: z.string().nullable(),
    vehicle: vehicleSchema,
    shiftStatus: z.enum(SHIFT_STATUSES),
    lastLocation: z
      .object({
        position: latLngSchema,
        accuracyM: z.number().nullable(),
        recordedAt: isoDateTime,
      })
      .nullable(),
    lastSeenAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('Agent');
export type AgentDto = z.infer<typeof agentDto>;

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,32}$/, 'must be a valid phone number')
  .openapi({ example: '+91 98765 43210' });

export const createAgentBody = z
  .object({
    name: text(120).openapi({ example: 'Arjun Mehta' }),
    email: emailSchema,
    temporaryPassword: passwordSchema,
    /** Required for managers (must be one of their teams); optional for admins. */
    teamId: objectIdSchema.nullable().optional(),
    employeeCode: text(40).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    vehicle: vehicleSchema.optional(),
  })
  .strict()
  .openapi('CreateAgentRequest');
export type CreateAgentBody = z.infer<typeof createAgentBody>;

export const updateAgentBody = z
  .object({
    name: text(120).optional(),
    teamId: objectIdSchema.nullable().optional(),
    employeeCode: text(40).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    vehicle: vehicleSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'at least one field is required')
  .openapi('UpdateAgentRequest');
export type UpdateAgentBody = z.infer<typeof updateAgentBody>;

export const listAgentsQuery = paginationQuery.extend({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .openapi({ description: 'Matches name, email or employee code.' }),
  teamId: objectIdSchema.optional(),
  shiftStatus: csvEnum(SHIFT_STATUSES),
  status: csvEnum(USER_STATUSES),
  sort: sortQuery(['name', 'employeeCode', 'createdAt', 'lastSeenAt'], 'name'),
});
export type ListAgentsQuery = z.infer<typeof listAgentsQuery>;
