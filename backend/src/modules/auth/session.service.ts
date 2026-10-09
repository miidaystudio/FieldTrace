import type { Types } from 'mongoose';
import { AuthSession } from './session.model.js';

/** Revokes every active session of a user (optionally keeping one, e.g. the caller's). */
export async function revokeUserSessions(
  orgId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  reason: string,
  exceptSessionId?: string,
): Promise<void> {
  await AuthSession.updateMany(
    {
      orgId,
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}),
    },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}
