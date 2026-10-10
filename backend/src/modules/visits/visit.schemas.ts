import { paginationQuery, sortQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import {
  GEOFENCE_EVENT_TYPES,
  VISIT_EVIDENCE_TYPES,
  VISIT_METHODS,
  VISIT_REVIEW_REASONS,
  VISIT_STATUSES,
} from '../../shared/enums.js';
import {
  csvEnum,
  dateOnly,
  isoDateTime,
  latLngSchema,
  objectIdSchema,
  text,
} from '../../shared/schemas.js';

export const visitDto = z
  .object({
    id: objectIdSchema,
    agentId: objectIdSchema,
    agent: z.object({ id: objectIdSchema, name: z.string() }).nullable(),
    teamId: objectIdSchema.nullable(),
    locationId: objectIdSchema,
    location: z
      .object({
        id: objectIdSchema,
        name: z.string(),
        address: z.string().nullable(),
        position: latLngSchema,
      })
      .nullable(),
    assignmentId: objectIdSchema.nullable(),
    method: z.enum(VISIT_METHODS),
    status: z.enum(VISIT_STATUSES),
    isOpen: z.boolean(),
    visitDate: dateOnly,
    checkInAt: isoDateTime.nullable(),
    checkOutAt: isoDateTime.nullable(),
    durationSec: z.number().int().nullable(),
    /** Present when the linked assignment has a time window. Positive delay = late. */
    arrival: z
      .object({
        windowStart: isoDateTime,
        windowEnd: isoDateTime,
        delaySec: z.number().int(),
        onTime: z.boolean(),
      })
      .nullable(),
    signals: z.object({
      sampleCount: z.number().int(),
      avgAccuracyM: z.number().nullable(),
      maxAccuracyM: z.number().nullable(),
      mockLocation: z.boolean(),
    }),
    /** Why the visit was not auto-verified (empty when verified automatically). */
    reviewReasons: z.array(z.enum(VISIT_REVIEW_REASONS)),
    evidence: z.array(
      z.object({
        type: z.enum(VISIT_EVIDENCE_TYPES),
        at: isoDateTime,
        position: latLngSchema,
        accuracyM: z.number().nullable(),
        insideGeofence: z.boolean(),
        distanceM: z.number().nullable(),
      }),
    ),
    review: z
      .object({
        by: objectIdSchema,
        at: isoDateTime,
        decision: z.enum(['verified', 'rejected']),
        note: z.string().nullable(),
      })
      .nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .openapi('Visit');
export type VisitDto = z.infer<typeof visitDto>;

const fixSchema = {
  position: latLngSchema,
  accuracyM: z.number().min(0).max(100_000),
};

export const checkInBody = z
  .object({
    /** Preferred: the assignment being visited. */
    assignmentId: objectIdSchema.optional(),
    /** For unplanned visits without an assignment. */
    locationId: objectIdSchema.optional(),
    ...fixSchema,
  })
  .strict()
  .refine((body) => Boolean(body.assignmentId || body.locationId), {
    message: 'assignmentId or locationId is required',
    path: ['assignmentId'],
  })
  .openapi('VisitCheckInRequest');
export type CheckInBody = z.infer<typeof checkInBody>;

export const checkOutBody = z.object(fixSchema).strict().openapi('VisitCheckOutRequest');
export type CheckOutBody = z.infer<typeof checkOutBody>;

export const reviewVisitBody = z
  .object({
    decision: z.enum(['verified', 'rejected']),
    note: text(1000).nullable().optional(),
  })
  .strict()
  .refine((body) => body.decision !== 'rejected' || Boolean(body.note), {
    message: 'note is required when rejecting',
    path: ['note'],
  })
  .openapi('VisitReviewRequest');
export type ReviewVisitBody = z.infer<typeof reviewVisitBody>;

export const listVisitsQuery = paginationQuery.extend({
  date: dateOnly.optional(),
  dateFrom: dateOnly.optional(),
  dateTo: dateOnly.optional(),
  status: csvEnum(VISIT_STATUSES),
  agentId: objectIdSchema.optional(),
  locationId: objectIdSchema.optional(),
  assignmentId: objectIdSchema.optional(),
  sort: sortQuery(['checkInAt', 'visitDate', 'createdAt'], '-checkInAt'),
});
export type ListVisitsQuery = z.infer<typeof listVisitsQuery>;

export const myVisitsQuery = paginationQuery.extend({
  date: dateOnly.optional(),
  sort: sortQuery(['checkInAt', 'createdAt'], '-checkInAt'),
});
export type MyVisitsQuery = z.infer<typeof myVisitsQuery>;

export const geofenceEventDto = z
  .object({
    id: objectIdSchema,
    agentId: objectIdSchema,
    teamId: objectIdSchema.nullable(),
    locationId: objectIdSchema,
    type: z.enum(GEOFENCE_EVENT_TYPES),
    at: isoDateTime,
    position: latLngSchema,
    accuracyM: z.number().nullable(),
    dwellSec: z.number().int().nullable(),
  })
  .openapi('GeofenceEvent');
export type GeofenceEventDto = z.infer<typeof geofenceEventDto>;

export const listGeofenceEventsQuery = paginationQuery.extend({
  agentId: objectIdSchema.optional(),
  locationId: objectIdSchema.optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});
export type ListGeofenceEventsQuery = z.infer<typeof listGeofenceEventsQuery>;

// ---------------------------------------------------------------- route analysis

export const routeAnalysisDto = z
  .object({
    agentId: objectIdSchema,
    from: isoDateTime,
    to: isoDateTime,
    pointCount: z.number().int(),
    distanceM: z.number(),
    movingTimeSec: z.number().int(),
    stoppedTimeSec: z.number().int(),
    /** Places where the agent stayed ≥ 3 min within 50 m. */
    stops: z.array(
      z.object({
        start: isoDateTime,
        end: isoDateTime,
        durationSec: z.number().int(),
        position: latLngSchema,
        locationId: objectIdSchema.nullable(),
        locationName: z.string().nullable(),
        /** `unplanned` = not at any client location: a route-deviation signal, not proof of misconduct. */
        kind: z.enum(['client_site', 'unplanned']),
      }),
    ),
    /** Periods without GPS data (> 2 min between fixes) — app closed, no signal or device off. */
    gaps: z.array(z.object({ from: isoDateTime, to: isoDateTime, durationSec: z.number().int() })),
    /** Planned assignments of the day vs what actually happened. */
    plan: z.array(
      z.object({
        assignmentId: objectIdSchema,
        locationId: objectIdSchema,
        locationName: z.string().nullable(),
        plannedOrder: z.number().int(),
        actualOrder: z.number().int().nullable(),
        visitId: objectIdSchema.nullable(),
        visitStatus: z.enum(VISIT_STATUSES).nullable(),
        assignmentStatus: z.string(),
      }),
    ),
    /** Visited in a different sequence than planned. */
    outOfOrder: z.boolean(),
  })
  .openapi('RouteAnalysis');
export type RouteAnalysisDto = z.infer<typeof routeAnalysisDto>;

export const routeAnalysisQuery = z.object({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});
export type RouteAnalysisQuery = z.infer<typeof routeAnalysisQuery>;
