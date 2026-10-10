import { Schema, model, type Types } from 'mongoose';

export interface OrganizationSettings {
  /** Seconds without telemetry before an on-shift agent is shown as `stale`. */
  staleAfterSec: number;
  /** Seconds without telemetry before an agent is shown as `offline`. */
  offlineAfterSec: number;
  /** Days to keep raw location telemetry (applied in Phase 2). */
  telemetryRetentionDays: number;
  workingHours: { start: string; end: string; days: number[] };
  geofenceDefaults: { radiusM: number; minDwellSec: number };
}

export interface OrganizationDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  timezone: string;
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  staleAfterSec: 60,
  offlineAfterSec: 300,
  telemetryRetentionDays: 90,
  workingHours: { start: '08:00', end: '20:00', days: [1, 2, 3, 4, 5, 6] },
  geofenceDefaults: { radiusM: 100, minDwellSec: 120 },
};

const settingsSchema = new Schema<OrganizationSettings>(
  {
    staleAfterSec: { type: Number, required: true, default: DEFAULT_ORG_SETTINGS.staleAfterSec },
    offlineAfterSec: {
      type: Number,
      required: true,
      default: DEFAULT_ORG_SETTINGS.offlineAfterSec,
    },
    telemetryRetentionDays: {
      type: Number,
      required: true,
      default: DEFAULT_ORG_SETTINGS.telemetryRetentionDays,
    },
    workingHours: {
      start: { type: String, required: true, default: DEFAULT_ORG_SETTINGS.workingHours.start },
      end: { type: String, required: true, default: DEFAULT_ORG_SETTINGS.workingHours.end },
      days: { type: [Number], required: true, default: DEFAULT_ORG_SETTINGS.workingHours.days },
    },
    geofenceDefaults: {
      radiusM: {
        type: Number,
        required: true,
        default: DEFAULT_ORG_SETTINGS.geofenceDefaults.radiusM,
      },
      minDwellSec: {
        type: Number,
        required: true,
        default: DEFAULT_ORG_SETTINGS.geofenceDefaults.minDwellSec,
      },
    },
  },
  { _id: false },
);

const organizationSchema = new Schema<OrganizationDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    timezone: { type: String, required: true, default: 'UTC' },
    settings: { type: settingsSchema, required: true, default: () => ({}) },
  },
  { timestamps: true },
);

organizationSchema.index({ slug: 1 }, { unique: true });

export const Organization = model<OrganizationDoc>('Organization', organizationSchema);
