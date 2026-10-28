import { paginationQuery, sortQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import { ANOMALY_STATUSES, ANOMALY_TYPES, SEVERITIES } from '../../shared/enums.js';
import { csvEnum, isoDateTime, latLngSchema, objectIdSchema, text } from '../../shared/schemas.js';

const actorRef = z.object({ id: objectIdSchema, name: z.string() });

export const anomalyDto = z
  .object({
    id: objectIdSchema,
    agentId: objectIdSchema,
    agent: actorRef.nullable(),
    teamId: objectIdSchema.nullable(),
    sessionId: objectIdSchema.nullable(),
    type: z.enum(ANOMALY_TYPES),
    severity: z.enum(SEVERITIES),
    status: z.enum(ANOMALY_STATUSES),
    title: z.string(),
    explanation: z
      .string()
      .openapi({ description: 'Plain-language reason, built from `metrics`.' }),
    metrics: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .openapi({ description: 'The values that triggered the rule (units in the key name).' }),
    position: latLngSchema.nullable(),
    locationId: objectIdSchema.nullable(),
    visitId: objectIdSchema.nullable(),
    firstSeenAt: isoDateTime,
    lastSeenAt: isoDateTime,
    occurrences: z
      .number()
      .int()
      .openapi({ description: 'Repeats merged into this record while it was active.' }),
    acknowledged: z.object({ by: actorRef, at: isoDateTime }).nullable(),
    resolution: z
      .object({
        by: actorRef,
        at: isoDateTime,
        status: z.enum(['resolved', 'dismissed']),
        note: z.string().nullable(),
      })
      .nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('Anomaly');
export type AnomalyDto = z.infer<typeof anomalyDto>;

export const listAnomaliesQuery = paginationQuery.extend({
  status: csvEnum(ANOMALY_STATUSES),
  type: csvEnum(ANOMALY_TYPES),
  severity: csvEnum(SEVERITIES),
  agentId: objectIdSchema.optional(),
  teamId: objectIdSchema.optional(),
  from: isoDateTime.optional().openapi({ description: 'Last seen at or after.' }),
  to: isoDateTime.optional().openapi({ description: 'First seen at or before.' }),
  sort: sortQuery(['lastSeenAt', 'firstSeenAt'], '-lastSeenAt'),
});
export type ListAnomaliesQuery = z.infer<typeof listAnomaliesQuery>;

export const updateAnomalyStatusBody = z
  .object({
    status: z.enum(['acknowledged', 'resolved', 'dismissed']),
    note: text(1000).optional(),
  })
  .strict()
  .refine((body) => body.status !== 'resolved' || body.note !== undefined, {
    message: 'note is required when resolving',
    path: ['note'],
  })
  .openapi('UpdateAnomalyStatusRequest');
export type UpdateAnomalyStatusBody = z.infer<typeof updateAnomalyStatusBody>;

export const anomalyStatsDto = z
  .object({
    active: z.number().int(),
    byStatus: z.record(z.enum(ANOMALY_STATUSES), z.number().int()),
    activeByType: z.record(z.enum(ANOMALY_TYPES), z.number().int()),
    activeBySeverity: z.record(z.enum(SEVERITIES), z.number().int()),
  })
  .openapi('AnomalyStats');
export type AnomalyStatsDto = z.infer<typeof anomalyStatsDto>;
