import type { Request } from 'express';
import { Types } from 'mongoose';
import { unauthenticated } from '../lib/errors.js';
import { requestIdOf } from '../lib/requestId.js';
import { AuthSession } from '../modules/auth/session.model.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { User } from '../modules/users/user.model.js';
import type { Actor } from '../shared/types.js';

export interface TokenContext {
  requestId: string;
  ip: string | undefined;
}

/**
 * Verifies an access token and re-checks the user and session in the database, so that
 * deactivation, role changes and logout take effect immediately rather than when the token
 * expires. Role always comes from the database, not the token. Shared by HTTP and Socket.IO.
 */
export async function authenticateToken(
  token: string | undefined,
  context: TokenContext,
): Promise<Actor & { tokenExpiresAt: number }> {
  if (!token) throw unauthenticated();
  const claims = await verifyAccessToken(token);

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
    requestId: context.requestId,
    ip: context.ip,
    tokenExpiresAt: claims.expiresAt,
  };
}

/** Resolves the caller of an HTTP request from `Authorization: Bearer <accessToken>`. */
export async function authenticate(req: Request): Promise<Actor> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthenticated();
  const { tokenExpiresAt, ...actor } = await authenticateToken(
    header.slice('Bearer '.length).trim(),
    { requestId: requestIdOf(req), ip: req.ip },
  );
  return actor;
}
