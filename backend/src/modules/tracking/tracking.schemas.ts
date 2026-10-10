import { env } from '../../config/env.js';
import { z } from '../../lib/zod.js';
import {
  CONNECTIVITY_STATUSES,
  DEVICE_PLATFORMS,
  MOTION_STATUSES,
  SHIFT_STATUSES,
  TELEMETRY_FLAGS,
  TELEMETRY_REJECT_REASONS,
  VEHICLE_TYPES,
} from '../../shared/enums.js';
import { csvEnum, isoDateTime, latLngSchema, objectIdSchema } from '../../shared/schemas.js';

// ---------------------------------------------------------------- shifts

export const startShiftBody = z
  .object({
    device: z
      .object({
        platform: z.enum(DEVICE_PLATFORMS).default('other'),
        appVersion: z.string().trim().max(40).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .openapi('StartShiftRequest');
export type StartShiftBody = z.infer<typeof startShiftBody>;

export const breakBody = z.object({ onBreak: z.boolean() }).strict().openapi('ShiftBreakRequest');

export const shiftSessionDto = z
  .object({
    /** Send this as `sessionId` with every telemetry batch. */
    id: objectIdSchema,
    agentId: objectIdSchema,
    isActive: z.boolean(),
    shiftStatus: z.enum(SHIFT_STATUSES),
    startedAt: isoDateTime,
    endedAt: isoDateTime.nullable(),
    sampleCount: z.number().int(),
    lastSampleAt: isoDateTime.nullable(),
    device: z.object({
      platform: z.enum(DEVICE_PLATFORMS),
      appVersion: z.string().nullable(),
    }),
  })
  .openapi('ShiftSession');
export type ShiftSessionDto = z.infer<typeof shiftSessionDto>;

export const currentShiftDto = z
  .object({ session: shiftSessionDto.nullable() })
  .openapi('CurrentShift');

// ---------------------------------------------------------------- telemetry

export const telemetrySampleSchema = z
  .object({
    /** Per-session, monotonically increasing sample number assigned by the device. */
    seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    /** Reported horizontal accuracy (metres, 68% radius). */
    accuracyM: z.number().min(0).max(100_000),
    /** Device time of the fix. */
    recordedAt: isoDateTime,
    speedMps: z.number().min(0).max(150).nullable().optional(),
    headingDeg: z.number().min(0).max(360).nullable().optional(),
    altitudeM: z.number().min(-1000).max(20_000).nullable().optional(),
    batteryPct: z.number().min(0).max(100).nullable().optional(),
    /** Device-reported mock-location signal (Android `isFromMockProvider`), if available. */
    isMock: z.boolean().optional(),
  })
  .strict()
  .openapi('TelemetrySample');
export type TelemetrySample = z.infer<typeof telemetrySampleSchema>;

export const telemetryBatchBody = z
  .object({
    sessionId: objectIdSchema,
    samples: z.array(telemetrySampleSchema).min(1).max(env.TELEMETRY_MAX_BATCH),
  })
  .strict()
  .openapi('TelemetryBatchRequest');
export type TelemetryBatchBody = z.infer<typeof telemetryBatchBody>;

export const telemetryResultDto = z
  .object({
    accepted: z.number().int(),
    /** Already ingested earlier (safe to drop from the device queue). */
    duplicates: z.number().int(),
    /** Not stored; do not retry these. */
    rejected: z.array(
      z.object({ seq: z.number().int(), reason: z.enum(TELEMETRY_REJECT_REASONS) }),
    ),
    /** Lets the device detect clock skew. */
    serverTime: isoDateTime,
  })
  .openapi('TelemetryBatchResult');
export type TelemetryResultDto = z.infer<typeof telemetryResultDto>;

// ---------------------------------------------------------------- fleet

export const liveAgentDto = z
  .object({
    agentId: objectIdSchema,
    name: z.string(),
    teamId: objectIdSchema.nullable(),
    employeeCode: z.string().nullable(),
    vehicle: z.object({ type: z.enum(VEHICLE_TYPES), plate: z.string().nullable() }),
    shiftStatus: z.enum(SHIFT_STATUSES),
    connectivity: z.enum(CONNECTIVITY_STATUSES),
    motion: z.enum(MOTION_STATUSES).nullable(),
    position: latLngSchema.nullable(),
    accuracyM: z.number().nullable(),
    speedMps: z.number().nullable(),
    headingDeg: z.number().nullable(),
    batteryPct: z.number().nullable(),
    flags: z.array(z.enum(TELEMETRY_FLAGS)),
    /** Device time of the latest fix. */
    recordedAt: isoDateTime.nullable(),
    lastSeenAt: isoDateTime.nullable(),
  })
  .openapi('LiveAgent');
export type LiveAgentDto = z.infer<typeof liveAgentDto>;

export const fleetLiveQuery = z.object({
  teamId: objectIdSchema.optional(),
  connectivity: csvEnum(CONNECTIVITY_STATUSES),
  shiftStatus: csvEnum(SHIFT_STATUSES),
});
export type FleetLiveQuery = z.infer<typeof fleetLiveQuery>;

export const fleetLiveDto = z
  .object({
    agents: z.array(liveAgentDto),
    /** Server time used to compute connectivity. */
    asOf: isoDateTime,
  })
  .openapi('FleetLive');

// ---------------------------------------------------------------- history

export const MAX_TRACK_WINDOW_MS = 24 * 3_600_000;
export const DEFAULT_TRACK_WINDOW_MS = 2 * 3_600_000;

export const trackQuery = z
  .object({
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    limit: z.coerce.number().int().min(1).max(5000).default(2000),
  })
  .openapi('TrackQuery');
export type TrackQuery = z.infer<typeof trackQuery>;

export const trackPointDto = z
  .object({
    lat: z.number(),
    lng: z.number(),
    accuracyM: z.number(),
    speedMps: z.number().nullable(),
    headingDeg: z.number().nullable(),
    recordedAt: isoDateTime,
    flags: z.array(z.enum(TELEMETRY_FLAGS)),
  })
  .openapi('TrackPoint');

export const trackDto = z
  .object({
    agentId: objectIdSchema,
    from: isoDateTime,
    to: isoDateTime,
    /** Ordered by `recordedAt` ascending. */
    points: z.array(trackPointDto),
    pointCount: z.number().int(),
    /** True when `limit` cut the window; request again with `from` = `nextFrom`. */
    truncated: z.boolean(),
    nextFrom: isoDateTime.nullable(),
    /** Sum of great-circle distances between consecutive points (approximate). */
    distanceM: z.number(),
  })
  .openapi('Track');
export type TrackDto = z.infer<typeof trackDto>;
