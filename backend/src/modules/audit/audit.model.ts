import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { ROLES, type Role } from '../../shared/enums.js';

export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

/**
 * Append-only record of security- and operations-relevant changes. No TTL: retention for audit
 * data has not been defined yet, so nothing is expired automatically.
 */
export interface AuditLogDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  actorId: Types.ObjectId | null;
  actorRole: Role | null;
  /** `<entity>.<verb>`, e.g. `user.role_changed`, `location.updated`. */
  action: string;
  entityType: string;
  entityId: Types.ObjectId;
  changes: FieldChanges | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  ip: string | null;
  at: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, enum: [...ROLES, null], default: null },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    changes: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    requestId: { type: String, default: null },
    ip: { type: String, default: null },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

auditLogSchema.index({ orgId: 1, at: -1 });
auditLogSchema.index({ orgId: 1, entityType: 1, entityId: 1, at: -1 });
auditLogSchema.index({ orgId: 1, actorId: 1, at: -1 });
auditLogSchema.plugin(tenantScopedPlugin);

export const AuditLog = model<AuditLogDoc>('AuditLog', auditLogSchema);
