import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';

/**
 * One document per login ("token family"). The refresh token rotates on every use; previously
 * issued hashes are kept so that replay of an old token can be detected and the whole session
 * revoked.
 */
export interface AuthSessionDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  previousTokenHashes: string[];
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Number of rotated hashes remembered for reuse detection. */
export const MAX_PREVIOUS_TOKEN_HASHES = 50;

const authSessionSchema = new Schema<AuthSessionDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: { type: String, required: true },
    previousTokenHashes: { type: [String], default: [] },
    userAgent: { type: String, default: null, maxlength: 512 },
    ip: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true, default: () => new Date() },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true },
);

authSessionSchema.index({ refreshTokenHash: 1 }, { unique: true });
authSessionSchema.index({ previousTokenHashes: 1 });
authSessionSchema.index({ orgId: 1, userId: 1, revokedAt: 1 });
// Retention: sessions are deleted automatically once their refresh window has passed.
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.plugin(tenantScopedPlugin);

export const AuthSession = model<AuthSessionDoc>('AuthSession', authSessionSchema);
