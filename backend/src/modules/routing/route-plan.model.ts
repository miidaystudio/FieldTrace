import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { ASSIGNMENT_PRIORITIES, type AssignmentPriority } from '../../shared/enums.js';

export const ROUTE_PLAN_STATUSES = ['active', 'superseded'] as const;
export type RoutePlanStatus = (typeof ROUTE_PLAN_STATUSES)[number];
export const START_SOURCES = ['current', 'last_known', 'custom', 'first_stop'] as const;
export type StartSource = (typeof START_SOURCES)[number];

export interface PlannedStop {
  sequence: number;
  assignmentId: Types.ObjectId;
  locationId: Types.ObjectId;
  lat: number;
  lng: number;
  priority: AssignmentPriority;
  windowStart: Date | null;
  windowEnd: Date | null;
  serviceSec: number;
  eta: Date;
  departure: Date;
  waitSec: number;
  lateSec: number;
  legDistanceM: number;
  legDurationSec: number;
}

/**
 * An agent's planned stop order for one day. Saving a new plan supersedes the previous one; the
 * active plan defines the "planned order" used by route analysis.
 */
export interface RoutePlanDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  teamId: Types.ObjectId | null;
  date: string;
  status: RoutePlanStatus;
  provider: 'openrouteservice' | 'builtin';
  start: { lat: number; lng: number; source: StartSource };
  departAt: Date;
  returnToStart: boolean;
  stops: PlannedStop[];
  totals: {
    distanceM: number;
    durationSec: number;
    travelSec: number;
    waitSec: number;
    lateSec: number;
    lateStops: number;
  };
  geometry: { lat: number; lng: number }[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const plannedStopSchema = new Schema<PlannedStop>(
  {
    sequence: { type: Number, required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClientLocation', required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    priority: { type: String, enum: ASSIGNMENT_PRIORITIES, required: true },
    windowStart: { type: Date, default: null },
    windowEnd: { type: Date, default: null },
    serviceSec: { type: Number, required: true },
    eta: { type: Date, required: true },
    departure: { type: Date, required: true },
    waitSec: { type: Number, required: true },
    lateSec: { type: Number, required: true },
    legDistanceM: { type: Number, required: true },
    legDurationSec: { type: Number, required: true },
  },
  { _id: false },
);

const routePlanSchema = new Schema<RoutePlanDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ROUTE_PLAN_STATUSES, required: true, default: 'active' },
    provider: { type: String, enum: ['openrouteservice', 'builtin'], required: true },
    start: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      source: { type: String, enum: START_SOURCES, required: true },
    },
    departAt: { type: Date, required: true },
    returnToStart: { type: Boolean, required: true, default: false },
    stops: { type: [plannedStopSchema], default: [] },
    totals: {
      distanceM: { type: Number, required: true },
      durationSec: { type: Number, required: true },
      travelSec: { type: Number, required: true },
      waitSec: { type: Number, required: true },
      lateSec: { type: Number, required: true },
      lateStops: { type: Number, required: true },
    },
    geometry: {
      type: [new Schema({ lat: Number, lng: Number }, { _id: false })],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

routePlanSchema.index(
  { orgId: 1, agentId: 1, date: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_plan_per_day' },
);
routePlanSchema.index({ orgId: 1, teamId: 1, date: 1 });
routePlanSchema.plugin(tenantScopedPlugin);

export const RoutePlan = model<RoutePlanDoc>('RoutePlan', routePlanSchema, 'route_plans');
