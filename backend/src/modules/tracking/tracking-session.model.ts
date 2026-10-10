import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { DEVICE_PLATFORMS, type DevicePlatform } from '../../shared/enums.js';

export const SESSION_END_REASONS = ['ended_by_agent', 'agent_deactivated'] as const;
export type SessionEndReason = (typeof SESSION_END_REASONS)[number];

/** One shift of one agent. Telemetry is only accepted against an active session. */
export interface TrackingSessionDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  userId: Types.ObjectId;
  /** Agent's team when the shift started (used for realtime room routing during the shift). */
  teamId: Types.ObjectId | null;
  isActive: boolean;
  startedAt: Date;
  endedAt: Date | null;
  endReason: SessionEndReason | null;
  device: { platform: DevicePlatform; appVersion: string | null; userAgent: string | null };
  sampleCount: number;
  lastSampleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const trackingSessionSchema = new Schema<TrackingSessionDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    isActive: { type: Boolean, required: true, default: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    endReason: { type: String, enum: [...SESSION_END_REASONS, null], default: null },
    device: {
      platform: { type: String, enum: DEVICE_PLATFORMS, required: true, default: 'other' },
      appVersion: { type: String, default: null, maxlength: 40 },
      userAgent: { type: String, default: null, maxlength: 512 },
    },
    sampleCount: { type: Number, required: true, default: 0 },
    lastSampleAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// At most one active shift per agent (enforced by the database, not just the service).
trackingSessionSchema.index(
  { orgId: 1, agentId: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'one_active_session_per_agent',
  },
);
trackingSessionSchema.index({ orgId: 1, agentId: 1, startedAt: -1 });
trackingSessionSchema.index({ isActive: 1 });
trackingSessionSchema.plugin(tenantScopedPlugin);

export const TrackingSession = model<TrackingSessionDoc>('TrackingSession', trackingSessionSchema);
