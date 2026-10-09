import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError, ErrorCode } from '../lib/errors.js';

/** Per-IP limiter for credential endpoints. In-memory for now; moves to Redis in Phase 2. */
export function authRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: env.AUTH_RATE_LIMIT_PER_MIN,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(429, ErrorCode.RATE_LIMITED, 'Too many attempts, please try again shortly'),
      );
    },
  });
}
