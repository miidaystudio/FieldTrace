import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import {
  ANOMALY_STATUSES,
  ANOMALY_TYPES,
  SEVERITIES,
  type AnomalyStatus,
  type AnomalyType,
  type Severity,
} from '../../shared/enums.js';

/** Numbers/labels that triggered the rule, shown as-is to the reviewer. */
export type AnomalyMetrics = Record<string, string | number | boolean | null>;

/**
 * One explainable signal about an agent (impossible speed, mock location, long gap…). Repeats of
 * the same signal while it is still active (`open`/`acknowledged`) are merged into one record via
 * `dedupeKey` (count + last seen), so managers get one item per problem, not one per GPS fix.
 */
export interface AnomalyDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  teamId: Types.ObjectId | null;
  sessionId: Types.ObjectId | null;
  type: AnomalyType;
  severity: Severity;
  status: AnomalyStatus;
  /** `open` or `acknowledged`. Backs the "one active record per dedupeKey" index. */
  isActive: boolean;
  dedupeKey: string;
  title: string;
  explanation: string;
  metrics: AnomalyMetrics;
  position: { lat: number; lng: number } | null;
  locationId: Types.ObjectId | null;
  visitId: Types.ObjectId | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrences: number;
  acknowledged: { by: Types.ObjectId; at: Date } | null;
  resolution: {
    by: Types.ObjectId;
    at: Date;
    status: 'resolved' | 'dismissed';
    note: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const anomalySchema = new Schema<AnomalyDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: 'TrackingSession', default: null },
    type: { type: String, enum: ANOMALY_TYPES, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    status: { type: String, enum: ANOMALY_STATUSES, required: true, default: 'open' },
    isActive: { type: Boolean, required: true, default: true },
    dedupeKey: { type: String, required: true, maxlength: 200 },
    title: { type: String, required: true, maxlength: 200 },
    explanation: { type: String, required: true, maxlength: 1000 },
    metrics: { type: Schema.Types.Mixed, default: () => ({}) },
    position: {
      type: new Schema(
        { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
        { _id: false },
      ),
      default: null,
    },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClientLocation', default: null },
    visitId: { type: Schema.Types.ObjectId, ref: 'Visit', default: null },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    occurrences: { type: Number, required: true, default: 1 },
    acknowledged: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    resolution: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          at: { type: Date, required: true },
          status: { type: String, enum: ['resolved', 'dismissed'], required: true },
          note: { type: String, default: null, maxlength: 1000 },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true, minimize: false },
);

anomalySchema.index(
  { orgId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_per_key' },
);
anomalySchema.index({ orgId: 1, status: 1, lastSeenAt: -1 });
anomalySchema.index({ orgId: 1, teamId: 1, lastSeenAt: -1 });
anomalySchema.index({ orgId: 1, agentId: 1, lastSeenAt: -1 });
anomalySchema.index({ orgId: 1, firstSeenAt: 1 });
anomalySchema.plugin(tenantScopedPlugin);

export const Anomaly = model<AnomalyDoc>('Anomaly', anomalySchema);
