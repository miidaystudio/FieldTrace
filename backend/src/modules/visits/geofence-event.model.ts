import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { GEOFENCE_EVENT_TYPES, type GeofenceEventType } from '../../shared/enums.js';

/** A confirmed geofence transition (entry, or exit after the debounce). Append-only. */
export interface GeofenceEventDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  teamId: Types.ObjectId | null;
  locationId: Types.ObjectId;
  sessionId: Types.ObjectId | null;
  type: GeofenceEventType;
  /** Device time of the fix that confirmed the transition. */
  at: Date;
  lat: number;
  lng: number;
  accuracyM: number | null;
  /** Exit only: time spent inside. */
  dwellSec: number | null;
  createdAt: Date;
}

const geofenceEventSchema = new Schema<GeofenceEventDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClientLocation', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'TrackingSession', default: null },
    type: { type: String, enum: GEOFENCE_EVENT_TYPES, required: true },
    at: { type: Date, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracyM: { type: Number, default: null },
    dwellSec: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

geofenceEventSchema.index({ orgId: 1, agentId: 1, at: -1 });
geofenceEventSchema.index({ orgId: 1, locationId: 1, at: -1 });
geofenceEventSchema.index({ orgId: 1, teamId: 1, at: -1 });
geofenceEventSchema.plugin(tenantScopedPlugin);

export const GeofenceEvent = model<GeofenceEventDoc>('GeofenceEvent', geofenceEventSchema);
