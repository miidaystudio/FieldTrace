import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { GEOFENCE_SHAPES, type GeofenceShape } from '../../shared/enums.js';
import type { GeoPoint } from '../agents/agent.model.js';

export interface GeoPolygon {
  type: 'Polygon';
  /** GeoJSON: one closed outer ring of [lng, lat] positions. */
  coordinates: number[][][];
}

/**
 * Geofences are embedded in their client location (1:1). A separate collection can be
 * introduced later if zones not tied to a client (depots, restricted areas) are needed.
 */
export interface Geofence {
  shape: GeofenceShape;
  radiusM: number | null;
  polygon: GeoPolygon | null;
}

export interface ClientLocationDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  address: string | null;
  contact: { name: string | null; phone: string | null; email: string | null };
  point: GeoPoint;
  geofence: Geofence;
  visitRules: { minDwellSec: number; requireQr: boolean; requirePhoto: boolean };
  tags: string[];
  externalRef: string | null;
  isArchived: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const clientLocationSchema = new Schema<ClientLocationDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, default: null, trim: true, maxlength: 300 },
    contact: {
      name: { type: String, default: null, trim: true, maxlength: 120 },
      phone: { type: String, default: null, trim: true, maxlength: 32 },
      email: { type: String, default: null, trim: true, lowercase: true, maxlength: 254 },
    },
    point: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    geofence: {
      shape: { type: String, enum: GEOFENCE_SHAPES, required: true },
      radiusM: { type: Number, default: null },
      polygon: {
        type: new Schema(
          {
            type: { type: String, enum: ['Polygon'], required: true },
            coordinates: { type: [[[Number]]], required: true },
          },
          { _id: false },
        ),
        default: null,
      },
    },
    visitRules: {
      minDwellSec: { type: Number, required: true, default: 120 },
      requireQr: { type: Boolean, required: true, default: false },
      requirePhoto: { type: Boolean, required: true, default: false },
    },
    tags: { type: [String], default: [] },
    externalRef: { type: String, default: null, trim: true, maxlength: 80 },
    isArchived: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

clientLocationSchema.index({ orgId: 1, point: '2dsphere' });
clientLocationSchema.index({ orgId: 1, isArchived: 1, name: 1 });
clientLocationSchema.index({ orgId: 1, tags: 1 });
clientLocationSchema.plugin(tenantScopedPlugin);

export const ClientLocation = model<ClientLocationDoc>('ClientLocation', clientLocationSchema);
