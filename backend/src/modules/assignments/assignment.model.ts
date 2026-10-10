import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import {
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_STATUSES,
  type AssignmentPriority,
  type AssignmentStatus,
} from '../../shared/enums.js';

export interface StatusChange {
  status: AssignmentStatus;
  at: Date;
  /** User who made the change, or null when the system did (visit verified, deadline passed). */
  by: Types.ObjectId | null;
  reason: string | null;
}

/** One assignment = one agent visiting one client location. A Route (Phase 5) orders them. */
export interface AssignmentDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  agentId: Types.ObjectId;
  /** Snapshot of the agent's team at creation, used for manager scoping and reports. */
  teamId: Types.ObjectId | null;
  locationId: Types.ObjectId;
  /** Calendar day in the organization's timezone, `YYYY-MM-DD`. */
  scheduledDate: string;
  window: { start: Date; end: Date } | null;
  deadline: Date | null;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  title: string | null;
  notes: string | null;
  routeId: Types.ObjectId | null;
  statusHistory: StatusChange[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<AssignmentDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'AgentProfile', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    locationId: { type: Schema.Types.ObjectId, ref: 'ClientLocation', required: true },
    scheduledDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    window: {
      type: new Schema(
        { start: { type: Date, required: true }, end: { type: Date, required: true } },
        { _id: false },
      ),
      default: null,
    },
    deadline: { type: Date, default: null },
    priority: { type: String, enum: ASSIGNMENT_PRIORITIES, required: true, default: 'normal' },
    status: { type: String, enum: ASSIGNMENT_STATUSES, required: true, default: 'pending' },
    title: { type: String, default: null, trim: true, maxlength: 120 },
    notes: { type: String, default: null, trim: true, maxlength: 2000 },
    routeId: { type: Schema.Types.ObjectId, ref: 'Route', default: null },
    statusHistory: {
      type: [
        new Schema<StatusChange>(
          {
            status: { type: String, enum: ASSIGNMENT_STATUSES, required: true },
            at: { type: Date, required: true },
            by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
            reason: { type: String, default: null, maxlength: 500 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

assignmentSchema.index({ orgId: 1, agentId: 1, scheduledDate: 1 });
assignmentSchema.index({ orgId: 1, teamId: 1, scheduledDate: 1 });
assignmentSchema.index({ orgId: 1, status: 1, deadline: 1 });
assignmentSchema.index({ orgId: 1, locationId: 1, scheduledDate: 1 });
assignmentSchema.plugin(tenantScopedPlugin);

export const Assignment = model<AssignmentDoc>('Assignment', assignmentSchema);
