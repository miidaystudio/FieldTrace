import { Schema, model, type Types } from 'mongoose';
import { env } from '../../config/env.js';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { TELEMETRY_FLAGS, type TelemetryFlag } from '../../shared/enums.js';

/**
 * Raw GPS history, stored in a MongoDB **time-series** collection (bucketed by agent, compact,
 * fast range scans). Redis holds only the latest position; this is the source of truth.
 *
 * Retention: collection-level TTL from TELEMETRY_RETENTION_DAYS. Time-series collections allow a
 * single TTL, so per-organization `telemetryRetentionDays` is not enforced yet (see README).
 */
export interface LocationTelemetryDoc {
  _id: Types.ObjectId;
  recordedAt: Date;
  receivedAt: Date;
  meta: { orgId: Types.ObjectId; agentId: Types.ObjectId; sessionId: Types.ObjectId };
  seq: number;
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps: number | null;
  headingDeg: number | null;
  altitudeM: number | null;
  batteryPct: number | null;
  flags: TelemetryFlag[];
}

const locationTelemetrySchema = new Schema<LocationTelemetryDoc>(
  {
    recordedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    meta: {
      orgId: { type: Schema.Types.ObjectId, required: true },
      agentId: { type: Schema.Types.ObjectId, required: true },
      sessionId: { type: Schema.Types.ObjectId, required: true },
    },
    seq: { type: Number, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracyM: { type: Number, required: true },
    speedMps: { type: Number, default: null },
    headingDeg: { type: Number, default: null },
    altitudeM: { type: Number, default: null },
    batteryPct: { type: Number, default: null },
    flags: { type: [{ type: String, enum: TELEMETRY_FLAGS }], default: [] },
  },
  {
    versionKey: false,
    autoCreate: true,
    timeseries: { timeField: 'recordedAt', metaField: 'meta', granularity: 'seconds' },
    expireAfterSeconds: env.TELEMETRY_RETENTION_DAYS * 86_400,
  },
);

locationTelemetrySchema.index({ 'meta.orgId': 1, 'meta.agentId': 1, recordedAt: 1 });
locationTelemetrySchema.plugin(tenantScopedPlugin, { field: 'meta.orgId' });

export const LocationTelemetry = model<LocationTelemetryDoc>(
  'LocationTelemetry',
  locationTelemetrySchema,
  'location_telemetry',
);
