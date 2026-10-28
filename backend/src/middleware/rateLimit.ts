import { MemoryStore, rateLimit, type Options, type Store } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { AppError, ErrorCode } from '../lib/errors.js';
import { getRealRedis } from '../lib/redis.js';

/**
 * Uses a Redis-backed counter when a real Redis is connected (shared by every API instance) and
 * an in-process counter otherwise (development / in-memory Redis). Decided on first use, because
 * the app is built before Redis connects.
 */
class LazyRedisStore implements Store {
  private delegate: Store | null = null;
  private options: Options | null = null;

  constructor(readonly prefix: string) {}

  init(options: Options): void {
    this.options = options;
  }

  private store(): Store {
    if (this.delegate) return this.delegate;
    const redis = getRealRedis();
    const store: Store = redis
      ? new RedisStore({
          prefix: this.prefix,
          sendCommand: (command: string, ...args: string[]) =>
            redis.call(command, ...args) as Promise<RedisReply>,
        })
      : new MemoryStore();
    if (this.options) void store.init?.(this.options);
    this.delegate = store;
    return store;
  }

  increment(key: string) {
    return this.store().increment(key);
  }

  decrement(key: string) {
    return this.store().decrement(key);
  }

  resetKey(key: string) {
    return this.store().resetKey(key);
  }
}

/** Per-IP limiter for credential endpoints (login, register, refresh). */
export function authRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    limit: env.AUTH_RATE_LIMIT_PER_MIN,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new LazyRedisStore(`${env.REDIS_KEY_PREFIX}rl:auth:`),
    handler: (_req, _res, next) => {
      next(
        new AppError(429, ErrorCode.RATE_LIMITED, 'Too many attempts, please try again shortly'),
      );
    },
  });
}
