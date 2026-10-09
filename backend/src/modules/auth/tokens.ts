import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { ErrorCode, unauthenticated } from '../../lib/errors.js';
import { ROLES, type Role } from '../../shared/enums.js';

const ISSUER = 'fieldtrace';
const AUDIENCE = 'fieldtrace-api';
const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenClaims {
  userId: string;
  orgId: string;
  role: Role;
  sessionId: string;
}

export async function signAccessToken(claims: AccessTokenClaims) {
  const token = await new SignJWT({ org: claims.orgId, role: claims.role, sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL_SEC}s`)
    .sign(secret);
  return { accessToken: token, expiresIn: env.JWT_ACCESS_TTL_SEC };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const { sub, org, role, sid } = payload;
    if (
      typeof sub !== 'string' ||
      typeof org !== 'string' ||
      typeof sid !== 'string' ||
      !ROLES.includes(role as Role)
    ) {
      throw unauthenticated('Malformed access token');
    }
    return { userId: sub, orgId: org, role: role as Role, sessionId: sid };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw unauthenticated('Access token expired', ErrorCode.TOKEN_EXPIRED);
    }
    if (error instanceof joseErrors.JOSEError) {
      throw unauthenticated('Invalid access token');
    }
    throw error;
  }
}

/** Opaque, high-entropy refresh token. Only its SHA-256 hash is stored. */
export const generateRefreshToken = () => randomBytes(32).toString('base64url');
export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');
