import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { requestIdOf } from '../../lib/requestId.js';
import { createModuleRouter } from '../../lib/route.js';
import { authRateLimiter } from '../../middleware/rateLimit.js';
import {
  authResponse,
  changePasswordBody,
  loginBody,
  meResponse,
  registerBody,
} from './auth.schemas.js';
import {
  changePassword,
  getMe,
  login,
  logout,
  logoutAll,
  refresh,
  register,
  type ClientMeta,
  type IssuedSession,
} from './auth.service.js';

export const REFRESH_COOKIE = 'ft_refresh';
const COOKIE_PATH = '/api/v1/auth';

export const authRoutes = createModuleRouter({ basePath: '/auth', tag: 'Auth' });

const clientMeta = (req: Request): ClientMeta => ({
  userAgent: req.get('user-agent'),
  ip: req.ip,
  requestId: requestIdOf(req),
});

function setRefreshCookie(res: Response, session: IssuedSession) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: COOKIE_PATH,
    expires: session.refreshExpiresAt,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: COOKIE_PATH,
  });
}

const readRefreshCookie = (req: Request): string | undefined => {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

authRoutes.route({
  method: 'post',
  path: '/register',
  summary: 'Create a new organization and its first admin account',
  description: 'Sets the `ft_refresh` httpOnly cookie and returns an access token.',
  auth: 'public',
  middleware: [authRateLimiter()],
  body: registerBody,
  status: 201,
  response: authResponse,
  errors: [409, 429],
  handler: async ({ body, req, res }) => {
    const session = await register(body, clientMeta(req));
    setRefreshCookie(res, session);
    return { data: session.body };
  },
});

authRoutes.route({
  method: 'post',
  path: '/login',
  summary: 'Log in with email and password',
  description:
    'Sets the `ft_refresh` httpOnly cookie and returns an access token. Wrong email and wrong ' +
    'password both return `401 INVALID_CREDENTIALS`.',
  auth: 'public',
  middleware: [authRateLimiter()],
  body: loginBody,
  response: authResponse,
  errors: [429],
  handler: async ({ body, req, res }) => {
    const session = await login(body, clientMeta(req));
    setRefreshCookie(res, session);
    return { data: session.body };
  },
});

authRoutes.route({
  method: 'post',
  path: '/refresh',
  summary: 'Exchange the refresh cookie for a new access token (rotates the cookie)',
  description:
    'Call on app start and when a request fails with `TOKEN_EXPIRED`. Clients must not run ' +
    'refreshes in parallel: re-using an already-rotated cookie revokes the session.',
  auth: 'public',
  middleware: [authRateLimiter()],
  response: authResponse,
  errors: [429],
  handler: async ({ req, res }) => {
    try {
      const session = await refresh(readRefreshCookie(req), clientMeta(req));
      setRefreshCookie(res, session);
      return { data: session.body };
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  },
});

authRoutes.route({
  method: 'post',
  path: '/logout',
  summary: 'Revoke the current session and clear the refresh cookie',
  description: 'Idempotent; succeeds even if the cookie is missing or already revoked.',
  auth: 'public',
  handler: async ({ req, res }) => {
    await logout(readRefreshCookie(req));
    clearRefreshCookie(res);
  },
});

authRoutes.route({
  method: 'post',
  path: '/logout-all',
  summary: 'Revoke every session of the current user (all devices)',
  auth: ['admin', 'manager', 'agent'],
  allowPendingPasswordChange: true,
  handler: async ({ actor, res }) => {
    await logoutAll(actor);
    clearRefreshCookie(res);
  },
});

authRoutes.route({
  method: 'get',
  path: '/me',
  summary: 'Current user and organization',
  description: 'Check `user.mustChangePassword` to route the user to the change-password screen.',
  auth: ['admin', 'manager', 'agent'],
  allowPendingPasswordChange: true,
  response: meResponse,
  handler: async ({ actor }) => ({ data: await getMe(actor) }),
});

authRoutes.route({
  method: 'post',
  path: '/change-password',
  summary: 'Change own password (also clears the temporary-password flag)',
  description: 'Signs out all other sessions; the current session stays valid.',
  auth: ['admin', 'manager', 'agent'],
  allowPendingPasswordChange: true,
  body: changePasswordBody,
  handler: async ({ actor, body }) => {
    await changePassword(actor, body);
  },
});
