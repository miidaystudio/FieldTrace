import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { ROLES, USER_STATUSES, type Role, type UserStatus } from '../../shared/enums.js';

export interface UserDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** Globally unique, stored lowercase. One user belongs to exactly one organization. */
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  /** Set when an admin/manager issues a temporary password. Blocks most routes until changed. */
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'active' },
    mustChangePassword: { type: Boolean, required: true, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ orgId: 1, role: 1, status: 1 });
userSchema.plugin(tenantScopedPlugin);

export const User = model<UserDoc>('User', userSchema);
