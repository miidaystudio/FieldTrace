import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';

export interface TeamDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  description: string | null;
  /** Managers who supervise this team. Single source of truth for manager scope. */
  managerIds: Types.ObjectId[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<TeamDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: null, trim: true, maxlength: 500 },
    managerIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    isArchived: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

// Case-insensitive unique team name per organization.
teamSchema.index({ orgId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
teamSchema.index({ orgId: 1, managerIds: 1 });
teamSchema.plugin(tenantScopedPlugin);

export const Team = model<TeamDoc>('Team', teamSchema);
