import type { Request } from 'express';
import { Types } from 'mongoose';
import { unauthenticated } from '../lib/errors.js';
import { requestIdOf } from '../lib/requestId.js';
import { AuthSession } from '../modules/auth/session.model.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { User } from '../modules/users/user.model.js';
import type { Actor } from '../shared/types.js';

/**
 * Resolves the caller from `Authorization: Bearer <accessToken>`.
 *
 * The token is verified cryptographically, then the user and session are re-checked in the
 * database so that deactivation, role changes and logout take effect immediately rather than
 * when the access token expires. Role always comes from the database, not the token.
 */
export async function authenticate(req: Request): Promise<Actor> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthenticated();
  const claims = await verifyAccessToken(header.slice('Bearer '.length).trim());

  if (![claims.userId, claims.orgId, claims.sessionId].every((id) => Types.ObjectId.isValid(id))) {
    throw unauthenticated('Invalid access token');
  }

  const [user, session] = await Promise.all([
    User.findOne({ _id: claims.userId, orgId: claims.orgId })
      .select('role status mustChangePassword')
      .lean(),
    AuthSession.findOne({ _id: claims.sessionId, orgId: claims.orgId, userId: claims.userId })
      .select('revokedAt expiresAt')
      .lean(),
  ]);

  if (!user || user.status !== 'active') throw unauthenticated('Account is not active');
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw unauthenticated('Session has ended');
  }

  return {
    userId: claims.userId,
    orgId: claims.orgId,
    role: user.role,
    sessionId: claims.sessionId,
    mustChangePassword: user.mustChangePassword,
    requestId: requestIdOf(req),
    ip: req.ip,
  };
}
