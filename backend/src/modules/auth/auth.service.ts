import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError, ErrorCode, notFound, unauthenticated } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { Actor } from '../../shared/types.js';
import { recordAudit, recordSystemAudit } from '../audit/audit.service.js';
import { Organization, type OrganizationDoc } from '../organizations/organization.model.js';
import { toOrganizationDto } from '../organizations/organization.service.js';
import { User, type UserDoc } from '../users/user.model.js';
import { assertEmailAvailable, toUserDto } from '../users/user.service.js';
import type { AuthResponse, ChangePasswordBody, LoginBody, RegisterBody } from './auth.schemas.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from './password.js';
import { revokeUserSessions } from './session.service.js';
import { AuthSession, MAX_PREVIOUS_TOKEN_HASHES } from './session.model.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './tokens.js';

export interface ClientMeta {
  userAgent: string | undefined;
  ip: string | undefined;
  requestId: string;
}

export interface IssuedSession {
  body: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const invalidCredentials = () =>
  new AppError(401, ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  if (!(await Organization.exists({ slug: base }))) return base;
  return `${base}-${randomBytes(3).toString('hex')}`;
}

async function issueSession(
  user: UserDoc,
  organization: OrganizationDoc,
  meta: ClientMeta,
): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const session = await AuthSession.create({
    orgId: user.orgId,
    userId: user._id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
    ip: meta.ip ?? null,
    expiresAt: refreshExpiresAt,
  });
  const access = await signAccessToken({
    userId: user._id.toString(),
    orgId: user.orgId.toString(),
    role: user.role,
    sessionId: session._id.toString(),
  });
  return {
    body: { user: toUserDto(user), organization: toOrganizationDto(organization), ...access },
    refreshToken,
    refreshExpiresAt,
  };
}

/** Self-service sign-up: creates a new organization and its first admin. */
export async function register(body: RegisterBody, meta: ClientMeta): Promise<IssuedSession> {
  await assertEmailAvailable(body.email);
  const passwordHash = await hashPassword(body.password);

  const organization = await Organization.create({
    name: body.organizationName,
    slug: await uniqueSlug(body.organizationName),
    timezone: body.timezone,
  });

  let user;
  try {
    user = await User.create({
      orgId: organization._id,
      name: body.name,
      email: body.email,
      role: 'admin',
      passwordHash,
      lastLoginAt: new Date(),
    });
  } catch (error) {
    // Compensating write instead of a transaction so standalone MongoDB works in development.
    await Organization.deleteOne({ _id: organization._id });
    throw error;
  }

  await recordSystemAudit(organization._id, user._id, {
    action: 'organization.created',
    entityType: 'organization',
    entityId: organization._id,
    metadata: { adminUserId: user._id.toString() },
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return issueSession(user.toObject(), organization.toObject(), meta);
}

export async function login(body: LoginBody, meta: ClientMeta): Promise<IssuedSession> {
  const user = await User.findOne({ email: body.email })
    .select('+passwordHash')
    .setOptions({ skipTenantCheck: true });

  if (!user) {
    await burnPasswordCheck(body.password);
    throw invalidCredentials();
  }
  if (!(await verifyPassword(user.passwordHash, body.password))) throw invalidCredentials();
  if (user.status !== 'active') throw unauthenticated('This account has been deactivated');

  const organization = await Organization.findOne({ _id: user.orgId }).lean();
  if (!organization) throw invalidCredentials();

  user.lastLoginAt = new Date();
  await user.save();
  return issueSession(user.toObject(), organization, meta);
}

/**
 * Rotates the refresh token. Presenting an already-rotated token is treated as theft: the whole
 * session (token family) is revoked, forcing both the attacker and the user to log in again.
 */
export async function refresh(
  refreshToken: string | undefined,
  meta: ClientMeta,
): Promise<IssuedSession> {
  if (!refreshToken) throw unauthenticated('No refresh token');
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  const session = await AuthSession.findOne({ refreshTokenHash: tokenHash }).setOptions({
    skipTenantCheck: true,
  });

  if (!session) {
    const reused = await AuthSession.findOneAndUpdate(
      { previousTokenHashes: tokenHash, revokedAt: null },
      { $set: { revokedAt: now, revokedReason: 'refresh_token_reuse' } },
    ).setOptions({ skipTenantCheck: true });
    if (reused) {
      logger.warn(
        { sessionId: reused._id.toString(), userId: reused.userId.toString(), ip: meta.ip },
        'Refresh token reuse detected; session revoked',
      );
    }
    throw unauthenticated('Invalid refresh token');
  }
  if (session.revokedAt || session.expiresAt <= now) throw unauthenticated('Session has ended');

  const [user, organization] = await Promise.all([
    User.findOne({ _id: session.userId, orgId: session.orgId }).lean(),
    Organization.findOne({ _id: session.orgId }).lean(),
  ]);
  if (!user || user.status !== 'active' || !organization) {
    await revokeUserSessions(session.orgId, session.userId, 'user_inactive');
    throw unauthenticated('Account is not active');
  }

  const nextToken = generateRefreshToken();
  const rotated = await AuthSession.findOneAndUpdate(
    { _id: session._id, orgId: session.orgId, refreshTokenHash: tokenHash, revokedAt: null },
    {
      $set: {
        refreshTokenHash: hashRefreshToken(nextToken),
        lastUsedAt: now,
        ...(meta.ip ? { ip: meta.ip } : {}),
      },
      $push: { previousTokenHashes: { $each: [tokenHash], $slice: -MAX_PREVIOUS_TOKEN_HASHES } },
    },
    { returnDocument: 'after' },
  );
  // Lost a race with a concurrent refresh using the same token.
  if (!rotated) throw unauthenticated('Invalid refresh token');

  const access = await signAccessToken({
    userId: user._id.toString(),
    orgId: user.orgId.toString(),
    role: user.role,
    sessionId: rotated._id.toString(),
  });
  return {
    body: { user: toUserDto(user), organization: toOrganizationDto(organization), ...access },
    refreshToken: nextToken,
    refreshExpiresAt: rotated.expiresAt,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await AuthSession.updateOne(
    { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
  ).setOptions({ skipTenantCheck: true });
}

export async function logoutAll(actor: Actor): Promise<void> {
  await revokeUserSessions(actor.orgId, actor.userId, 'logout_all');
  await recordAudit(actor, {
    action: 'user.logged_out_everywhere',
    entityType: 'user',
    entityId: actor.userId,
  });
}

export async function getMe(actor: Actor) {
  const [user, organization] = await Promise.all([
    User.findOne({ _id: actor.userId, orgId: actor.orgId }).lean(),
    Organization.findOne({ _id: actor.orgId }).lean(),
  ]);
  if (!user || !organization) throw notFound('User');
  return { user: toUserDto(user), organization: toOrganizationDto(organization) };
}

export async function changePassword(actor: Actor, body: ChangePasswordBody): Promise<void> {
  const user = await User.findOne({ _id: actor.userId, orgId: actor.orgId }).select(
    '+passwordHash',
  );
  if (!user) throw notFound('User');
  if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
    throw new AppError(400, ErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect');
  }
  if (body.currentPassword === body.newPassword) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      'New password must differ from the current one',
    );
  }
  user.passwordHash = await hashPassword(body.newPassword);
  user.mustChangePassword = false;
  await user.save();
  // Keep the caller signed in on this device; sign out everywhere else.
  await revokeUserSessions(actor.orgId, actor.userId, 'password_changed', actor.sessionId);
  await recordAudit(actor, {
    action: 'user.password_changed',
    entityType: 'user',
    entityId: user._id,
  });
}
