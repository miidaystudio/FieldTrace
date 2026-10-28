import { z } from '../../lib/zod.js';
import { ANOMALY_TYPES } from '../../shared/enums.js';
import { dateOnly, isoDateTime, objectIdSchema } from '../../shared/schemas.js';

export const MAX_RANGE_DAYS = 92;

export const analyticsQuery = z.object({
  from: dateOnly
    .optional()
    .openapi({ description: 'First day (org timezone). Default: 6 days before `to`.' }),
  to: dateOnly.optional().openapi({ description: 'Last day, inclusive. Default: today.' }),
  teamId: objectIdSchema.optional(),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuery>;

const rate = z
  .number()
  .min(0)
  .max(1)
  .nullable()
  .openapi({ description: 'Fraction 0–1, or null when there is nothing to divide by.' });

const visitCounts = z.object({
  total: z.number().int(),
  verified: z.number().int(),
  needsReview: z.number().int(),
  rejected: z.number().int(),
  missed: z.number().int(),
  inProgress: z.number().int(),
});

export const analyticsSummaryDto = z
  .object({
    from: dateOnly,
    to: dateOnly,
    teamId: objectIdSchema.nullable(),
    agentsActive: z.number().int(),
    distanceKm: z.number(),
    shiftHours: z.number(),
    visits: visitCounts,
    verificationRate: rate.openapi({
      description: 'verified / (verified + needsReview + rejected).',
    }),
    onTimeRate: rate.openapi({ description: 'On-time arrivals / visits with a time window.' }),
    avgDwellMin: z.number().nullable(),
    assignments: z.object({
      total: z.number().int(),
      completed: z.number().int(),
      completionRate: rate,
    }),
    anomalies: z.object({
      total: z.number().int(),
      high: z.number().int(),
      byType: z.record(z.enum(ANOMALY_TYPES), z.number().int()),
    }),
    generatedAt: isoDateTime,
  })
  .openapi('AnalyticsSummary');
export type AnalyticsSummaryDto = z.infer<typeof analyticsSummaryDto>;

export const analyticsDayDto = z
  .object({
    day: dateOnly,
    agentsActive: z.number().int(),
    distanceKm: z.number(),
    shiftHours: z.number(),
    visits: visitCounts,
    verificationRate: rate,
    onTimeRate: rate,
    assignmentsTotal: z.number().int(),
    assignmentsCompleted: z.number().int(),
    anomalies: z.number().int(),
  })
  .openapi('AnalyticsDay');
export type AnalyticsDayDto = z.infer<typeof analyticsDayDto>;

export const analyticsAgentDto = z
  .object({
    agentId: objectIdSchema,
    name: z.string(),
    teamId: objectIdSchema.nullable(),
    daysActive: z.number().int(),
    distanceKm: z.number(),
    shiftHours: z.number(),
    visits: visitCounts,
    verificationRate: rate,
    onTimeRate: rate,
    assignmentsTotal: z.number().int(),
    assignmentsCompleted: z.number().int(),
    anomalies: z.number().int(),
    highAnomalies: z.number().int(),
  })
  .openapi('AnalyticsAgent');
export type AnalyticsAgentDto = z.infer<typeof analyticsAgentDto>;
