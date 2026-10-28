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
  /** Thresholds of the explainable anomaly rules (Phase 4). May be absent on older documents. */
  anomalyRules?: Partial<AnomalyRules>;
}

/** Per-organization anomaly rule configuration. Each rule can be switched off. */
export interface AnomalyRules {
  /** Speed between two fixes (beyond their accuracy) above which travel is implausible. */
  impossibleSpeed: { enabled: boolean; maxSpeedKmh: number };
  /** A sudden displacement of at least `minDistanceM` within `maxIntervalSec`. */
  gpsJump: { enabled: boolean; minDistanceM: number; maxIntervalSec: number };
  /** The device reported a mock (simulated) location. */
  mockLocation: { enabled: boolean };
  /** No GPS for `minGapMin` minutes while on shift (not on break). */
  signalGap: { enabled: boolean; minGapMin: number };
  /** Stationary for `minStopMin` minutes outside every client geofence while on shift. */
  longUnplannedStop: { enabled: boolean; minStopMin: number };
  /** Visits sent to review or missed. */
  visitIssues: { enabled: boolean };
  /** Tracking outside the organization's working hours. */
  offHours: { enabled: boolean };
}

export const DEFAULT_ANOMALY_RULES: AnomalyRules = {
  impossibleSpeed: { enabled: true, maxSpeedKmh: 150 },
  gpsJump: { enabled: true, minDistanceM: 1000, maxIntervalSec: 30 },
  mockLocation: { enabled: true },
  signalGap: { enabled: true, minGapMin: 10 },
  longUnplannedStop: { enabled: true, minStopMin: 20 },
  visitIssues: { enabled: true },
  offHours: { enabled: true },
};

/** Stored rules merged over the defaults (older organizations have none stored). */
export function anomalyRulesOf(settings: Pick<OrganizationSettings, 'anomalyRules'>): AnomalyRules {
  const stored = settings.anomalyRules ?? {};
  const merged = { ...DEFAULT_ANOMALY_RULES };
  for (const key of Object.keys(DEFAULT_ANOMALY_RULES) as (keyof AnomalyRules)[]) {
    const value = stored[key];
    if (value)
      (merged as Record<string, object>)[key] = { ...DEFAULT_ANOMALY_RULES[key], ...value };
  }
  return merged;
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
    // Free-form here; validated by the API schema and merged over defaults on read.
    anomalyRules: { type: Schema.Types.Mixed, default: () => ({}) },
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
