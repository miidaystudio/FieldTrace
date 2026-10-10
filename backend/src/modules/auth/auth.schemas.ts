import { z } from '../../lib/zod.js';
import { text } from '../../shared/schemas.js';
import { organizationDto, timezoneSchema } from '../organizations/organization.schemas.js';
import { emailSchema, userDto } from '../users/user.schemas.js';
import { passwordSchema } from './password.js';

export const registerBody = z
  .object({
    organizationName: text(120).openapi({ example: 'Acme Logistics' }),
    timezone: timezoneSchema.default('UTC'),
    name: text(120).openapi({ example: 'Priya Sharma' }),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict()
  .openapi('RegisterRequest');
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict()
  .openapi('LoginRequest');
export type LoginBody = z.infer<typeof loginBody>;

export const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict()
  .openapi('ChangePasswordRequest');
export type ChangePasswordBody = z.infer<typeof changePasswordBody>;

export const authResponse = z
  .object({
    user: userDto,
    organization: organizationDto,
    accessToken: z
      .string()
      .openapi({ description: 'JWT. Send as `Authorization: Bearer <token>`.' }),
    expiresIn: z.number().int().openapi({ description: 'Access token lifetime in seconds.' }),
  })
  .openapi('AuthResponse');
export type AuthResponse = z.infer<typeof authResponse>;

export const meResponse = z
  .object({ user: userDto, organization: organizationDto })
  .openapi('MeResponse');
