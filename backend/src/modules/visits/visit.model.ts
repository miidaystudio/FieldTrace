import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import {
  VISIT_EVIDENCE_TYPES,
  VISIT_METHODS,
  VISIT_REVIEW_REASONS,
  VISIT_STATUSES,
  type VisitEvidenceType,
  type VisitMethod,
  type VisitReviewReason,
  type VisitStatus,
} from '../../shared/enums.js';

export interface VisitEvidence {
  type: VisitEvidenceType;
  at: Date;
  lat: number;
  lng: number;
  accuracyM: number | null;
  insideGeofence: boolean;
  /** Distance from the geofence centre (circle) or 0 when inside a polygon. */
  distanceM: number | null;
}

/** Aggregated GPS quality while the agent was inside the geofence. */
export interface VisitSignals {
  sampleCount: number;
  avgAccuracyM: number | null;
  maxAccuracyM: number | null;
  mockLocation: boolean;
}

/**
 * One agent's stay at one client location. Opened automatically after `minDwellSec` inside the
 * geofence (or by a manual check-in), closed on exit / check-out, then verified or sent to review.
 * `missed` visits are created by the assignment sweep when a planned stop was never visited.
 */
export interface VisitDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  teamId: Types.ObjectId | null;
  locationId: Types.ObjectId;
  assignmentId: Types.ObjectId | null;
  sessionId: Types.ObjectId | null;
  method: VisitMethod;
  status: VisitStatus;
  /** True until checked out / exited. At most one open visit per agent. */
  isOpen: boolean;
  /** Calendar day (organization timezone) of the check-in or the planned day for `missed`. */
  visitDate: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  durationSec: number | null;
  arrival: { windowStart: Date; windowEnd: Date; delaySec: number; onTime: boolean } | null;
  signals: VisitSignals;
  reviewReasons: VisitReviewReason[];
  evidence: VisitEvidence[];
  review: {
    by: Types.ObjectId;
    at: Date;
    decision: 'verified' | 'rejected';
    note: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<VisitEvidence>(
  {
    type: { type: String, enum: VISIT_EVIDENCE_TYPES, required: true },
    at: { type: Date, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracyM: { type: Number, default: null },
    insideGeofence: { type: Boolean, required: true },
    distanceM: { type: Number, default: null },
  },
  { _id: false },
);

const visitSchema = new Schema<VisitDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClientLocation', required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', default: null },
    sessionId: { type: Schema.Types.ObjectId, ref: 'TrackingSession', default: null },
    method: { type: String, enum: VISIT_METHODS, required: true },
    status: { type: String, enum: VISIT_STATUSES, required: true },
    isOpen: { type: Boolean, required: true, default: false },
    visitDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    durationSec: { type: Number, default: null },
    arrival: {
      type: new Schema(
        {
          windowStart: { type: Date, required: true },
          windowEnd: { type: Date, required: true },
          delaySec: { type: Number, required: true },
          onTime: { type: Boolean, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    signals: {
      sampleCount: { type: Number, required: true, default: 0 },
      avgAccuracyM: { type: Number, default: null },
      maxAccuracyM: { type: Number, default: null },
      mockLocation: { type: Boolean, required: true, default: false },
    },
    reviewReasons: { type: [{ type: String, enum: VISIT_REVIEW_REASONS }], default: [] },
    evidence: { type: [evidenceSchema], default: [] },
    review: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          at: { type: Date, required: true },
          decision: { type: String, enum: ['verified', 'rejected'], required: true },
          note: { type: String, default: null, maxlength: 1000 },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

visitSchema.index(
  { orgId: 1, agentId: 1 },
  { unique: true, partialFilterExpression: { isOpen: true }, name: 'one_open_visit_per_agent' },
);
visitSchema.index({ orgId: 1, visitDate: 1, status: 1 });
visitSchema.index({ orgId: 1, teamId: 1, visitDate: 1 });
visitSchema.index({ orgId: 1, agentId: 1, checkInAt: -1 });
visitSchema.index({ orgId: 1, assignmentId: 1 });
visitSchema.index({ orgId: 1, locationId: 1, checkInAt: -1 });
visitSchema.plugin(tenantScopedPlugin);

export const Visit = model<VisitDoc>('Visit', visitSchema);
