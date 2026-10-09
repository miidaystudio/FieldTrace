import { paginationQuery, sortQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import { ROLES, USER_STATUSES } from '../../shared/enums.js';
import { csvEnum, isoDateTime, objectIdSchema, text } from '../../shared/schemas.js';
import { passwordSchema } from '../auth/password.js';

export const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase())
  .openapi({ example: 'priya@acme-logistics.test' });

export const userDto = z
  .object({
    id: objectIdSchema,
    orgId: objectIdSchema,
    name: z.string(),
    email: z.string(),
    role: z.enum(ROLES),
    status: z.enum(USER_STATUSES),
    mustChangePassword: z.boolean(),
    lastLoginAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('User');
export type UserDto = z.infer<typeof userDto>;

/** Staff accounts only. Agents are created through POST /agents (which also creates their profile). */
const staffRole = z.enum(['admin', 'manager']);

export const createUserBody = z
  .object({
    name: text(120),
    email: emailSchema,
    role: staffRole,
    /** Shared with the user out-of-band; they must change it at first login. */
    temporaryPassword: passwordSchema,
  })
  .strict()
  .openapi('CreateUserRequest');
export type CreateUserBody = z.infer<typeof createUserBody>;

export const updateUserBody = z
  .object({
    name: text(120).optional(),
    role: staffRole.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'at least one field is required')
  .openapi('UpdateUserRequest');
export type UpdateUserBody = z.infer<typeof updateUserBody>;

export const resetPasswordBody = z
  .object({ temporaryPassword: passwordSchema })
  .strict()
  .openapi('ResetPasswordRequest');

export const listUsersQuery = paginationQuery.extend({
  role: csvEnum(ROLES),
  status: csvEnum(USER_STATUSES),
  q: z.string().trim().max(100).optional(),
  sort: sortQuery(['name', 'email', 'createdAt', 'lastLoginAt'], 'name'),
});
export type ListUsersQuery = z.infer<typeof listUsersQuery>;
