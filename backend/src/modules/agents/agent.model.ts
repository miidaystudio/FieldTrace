import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import {
  SHIFT_STATUSES,
  VEHICLE_TYPES,
  type ShiftStatus,
  type VehicleType,
} from '../../shared/enums.js';

export interface GeoPoint {
  type: 'Point';
  /** GeoJSON order: [lng, lat]. */
  coordinates: number[];
}

export interface AgentProfileDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** 1:1 link to the agent's login account (User with role `agent`). */
  userId: Types.ObjectId;
  teamId: Types.ObjectId | null;
  employeeCode: string | null;
  phone: string | null;
  vehicle: { type: VehicleType; plate: string | null };
  shiftStatus: ShiftStatus;
  /** Denormalised latest fix, written by telemetry ingestion (Phase 2). Redis is the hot copy. */
  lastLocation: { point: GeoPoint; accuracyM: number | null; recordedAt: Date } | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const agentProfileSchema = new Schema<AgentProfileDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    employeeCode: { type: String, default: null, trim: true, maxlength: 40 },
    phone: { type: String, default: null, trim: true, maxlength: 32 },
    vehicle: {
      type: {
        type: String,
        enum: VEHICLE_TYPES,
        required: true,
        default: 'none',
      },
      plate: { type: String, default: null, trim: true, maxlength: 20 },
    },
    shiftStatus: { type: String, enum: SHIFT_STATUSES, required: true, default: 'off_shift' },
    lastLocation: {
      type: new Schema(
        {
          point: {
            type: { type: String, enum: ['Point'], required: true },
            coordinates: { type: [Number], required: true },
          },
          accuracyM: { type: Number, default: null },
          recordedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

agentProfileSchema.index({ orgId: 1, userId: 1 }, { unique: true });
agentProfileSchema.index(
  { orgId: 1, employeeCode: 1 },
  { unique: true, partialFilterExpression: { employeeCode: { $type: 'string' } } },
);
agentProfileSchema.index({ orgId: 1, teamId: 1, shiftStatus: 1 });
agentProfileSchema.plugin(tenantScopedPlugin);

export const AgentProfile = model<AgentProfileDoc>('AgentProfile', agentProfileSchema);
