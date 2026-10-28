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

const enabled = z.boolean();
export const anomalyRulesSchema = z
  .object({
    impossibleSpeed: z.object({ enabled, maxSpeedKmh: z.number().int().min(60).max(1000) }),
    gpsJump: z.object({
      enabled,
      minDistanceM: z.number().int().min(200).max(50_000),
      maxIntervalSec: z.number().int().min(5).max(600),
    }),
    mockLocation: z.object({ enabled }),
    signalGap: z.object({ enabled, minGapMin: z.number().int().min(2).max(240) }),
    longUnplannedStop: z.object({ enabled, minStopMin: z.number().int().min(5).max(480) }),
    visitIssues: z.object({ enabled }),
    offHours: z.object({ enabled }),
  })
  .openapi('AnomalyRules', {
    description: 'Thresholds of the explainable anomaly rules. Each rule can be disabled.',
  });

/** Update shape: any rule, any of its fields. */
const rules = anomalyRulesSchema.shape;
export const anomalyRulesPatchSchema = z
  .object({
    impossibleSpeed: rules.impossibleSpeed.partial().strict().optional(),
    gpsJump: rules.gpsJump.partial().strict().optional(),
    mockLocation: rules.mockLocation.partial().strict().optional(),
    signalGap: rules.signalGap.partial().strict().optional(),
    longUnplannedStop: rules.longUnplannedStop.partial().strict().optional(),
    visitIssues: rules.visitIssues.partial().strict().optional(),
    offHours: rules.offHours.partial().strict().optional(),
  })
  .strict();

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
    anomalyRules: anomalyRulesSchema,
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
        anomalyRules: anomalyRulesPatchSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'at least one field is required')
  .openapi('UpdateOrganizationRequest');
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBody>;
