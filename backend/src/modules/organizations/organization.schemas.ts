import { z } from '../../lib/zod.js';
import { isoDateTime, objectIdSchema, text } from '../../shared/schemas.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm (24h)');

export const timezoneSchema = z
  .string()
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'must be a valid IANA timezone')
  .openapi({ example: 'Asia/Kolkata' });

export const organizationSettingsSchema = z
  .object({
    staleAfterSec: z.number().int().min(15).max(3600),
    offlineAfterSec: z.number().int().min(30).max(86_400),
    telemetryRetentionDays: z.number().int().min(1).max(730),
    workingHours: z.object({
      start: hhmm,
      end: hhmm,
      /** ISO weekday numbers, 1 = Monday … 7 = Sunday. */
      days: z.array(z.number().int().min(1).max(7)).max(7),
    }),
    geofenceDefaults: z.object({
      radiusM: z.number().int().min(10).max(5000),
      minDwellSec: z.number().int().min(0).max(86_400),
    }),
  })
  .openapi('OrganizationSettings');

export const organizationDto = z
  .object({
    id: objectIdSchema,
    name: z.string(),
    slug: z.string(),
    timezone: z.string(),
    settings: organizationSettingsSchema,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('Organization');
export type OrganizationDto = z.infer<typeof organizationDto>;

export const updateOrganizationBody = z
  .object({
    name: text(120).optional(),
    timezone: timezoneSchema.optional(),
    settings: z
      .object({
        staleAfterSec: organizationSettingsSchema.shape.staleAfterSec.optional(),
        offlineAfterSec: organizationSettingsSchema.shape.offlineAfterSec.optional(),
        telemetryRetentionDays: organizationSettingsSchema.shape.telemetryRetentionDays.optional(),
        workingHours: organizationSettingsSchema.shape.workingHours.optional(),
        geofenceDefaults: organizationSettingsSchema.shape.geofenceDefaults.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'at least one field is required')
  .openapi('UpdateOrganizationRequest');
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBody>;
