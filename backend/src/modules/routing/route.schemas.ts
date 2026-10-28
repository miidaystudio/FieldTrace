import { z } from '../../lib/zod.js';
import { ASSIGNMENT_PRIORITIES } from '../../shared/enums.js';
import { dateOnly, isoDateTime, latLngSchema, objectIdSchema } from '../../shared/schemas.js';
import { ROUTE_PLAN_STATUSES, START_SOURCES } from './route-plan.model.js';

export const MAX_ROUTE_STOPS = 20;

export const planRouteBody = z
  .object({
    agentId: objectIdSchema,
    date: dateOnly.optional().openapi({ description: 'Org-local day. Default: today.' }),
    assignmentIds: z.array(objectIdSchema).min(1).max(MAX_ROUTE_STOPS).optional().openapi({
      description:
        "Stops to sequence. Default: the agent's open (pending, overdue, in-progress) assignments of the day.",
    }),
    start: z
      .union([
        z.object({ type: z.literal('current') }),
        z.object({ type: z.literal('first_stop') }),
        z.object({ type: z.literal('position'), position: latLngSchema }),
      ])
      .default({ type: 'current' })
      .openapi({
        description:
          '`current` = live GPS (else last known position, else first stop); `position` = custom start.',
      }),
    departAt: isoDateTime
      .optional()
      .openapi({ description: 'Default: now for today, the start of working hours otherwise.' }),
    serviceMin: z
      .number()
      .min(0)
      .max(240)
      .default(10)
      .openapi({ description: 'Time spent at each stop, in minutes.' }),
    returnToStart: z.boolean().default(false),
  })
  .strict()
  .openapi('PlanRouteRequest');
export type PlanRouteBody = z.infer<typeof planRouteBody>;

const plannedStopDto = z.object({
  sequence: z.number().int(),
  assignmentId: objectIdSchema,
  locationId: objectIdSchema,
  locationName: z.string().nullable(),
  title: z.string().nullable(),
  position: latLngSchema,
  priority: z.enum(ASSIGNMENT_PRIORITIES),
  window: z.object({ start: isoDateTime, end: isoDateTime }).nullable(),
  serviceSec: z.number().int(),
  eta: isoDateTime,
  departure: isoDateTime,
  waitSec: z.number().int(),
  lateSec: z.number().int(),
  legDistanceM: z.number().int(),
  legDurationSec: z.number().int(),
});

const totalsDto = z.object({
  distanceM: z.number().int(),
  durationSec: z
    .number()
    .int()
    .openapi({ description: 'Departure to finish (travel + service + waiting).' }),
  travelSec: z.number().int(),
  waitSec: z.number().int(),
  lateSec: z.number().int(),
  lateStops: z.number().int(),
});

export const routePlanDto = z
  .object({
    id: objectIdSchema.nullable().openapi({ description: 'null for an unsaved preview.' }),
    agentId: objectIdSchema,
    teamId: objectIdSchema.nullable(),
    date: dateOnly,
    status: z.enum(ROUTE_PLAN_STATUSES).nullable(),
    provider: z.enum(['openrouteservice', 'builtin']),
    fallbackReason: z.string().nullable(),
    start: z.object({ position: latLngSchema, source: z.enum(START_SOURCES) }),
    departAt: isoDateTime,
    returnToStart: z.boolean(),
    stops: z.array(plannedStopDto),
    totals: totalsDto,
    baseline: totalsDto.nullable().openapi({
      description: 'Same stops in their current order (window start / creation) — for comparison.',
    }),
    geometry: z.array(latLngSchema),
    warnings: z.array(z.string()),
    createdAt: isoDateTime.nullable(),
  })
  .openapi('RoutePlan');
export type RoutePlanDto = z.infer<typeof routePlanDto>;

export const listRoutesQuery = z.object({
  date: dateOnly.optional(),
  agentId: objectIdSchema.optional(),
});
export type ListRoutesQuery = z.infer<typeof listRoutesQuery>;

export const myRouteQuery = z.object({ date: dateOnly.optional() });
