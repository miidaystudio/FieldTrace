import { Redis } from 'ioredis';
import { InMemoryRedis } from './in-memory-redis.js';
import { logger } from './logger.js';

let client: Redis | InMemoryRedis | null = null;

/**
 * Connects the shared Redis client. All keys are namespaced with `keyPrefix` (ioredis applies it
 * to command keys AND to `KEYS[]` of Lua scripts), so FieldTrace can share a Redis instance.
 *
 * Development convenience: `url = 'memory'`, or an unreachable Redis when `allowMemoryFallback`
 * is set, uses the in-process {@link InMemoryRedis}. Production never falls back — live state
 * would silently diverge between instances and vanish on restart — so it fails fast instead.
 */
export async function connectRedis(
  url: string,
  keyPrefix: string,
  options: { allowMemoryFallback?: boolean } = {},
): Promise<Redis> {
  const { allowMemoryFallback = false } = options;
  if (url === 'memory') {
    if (!allowMemoryFallback) {
      throw new Error('REDIS_URL=memory is for local development only; configure a real Redis');
    }
    logger.info('Using in-memory store for real-time tracking (Redis/Docker not required)');
    const mem = new InMemoryRedis(keyPrefix);
    client = mem;
    return mem as unknown as Redis;
  }

  const redis = new Redis(url, {
    keyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
  });

  redis.on('error', (error) => {
    // Only log once connected; initial connection errors are handled in the try/catch below
    if (client === redis) logger.error({ err: error }, 'Redis error');
  });
  redis.on('reconnecting', () => logger.warn('Redis reconnecting'));

  try {
    await redis.connect();
    client = redis;
    logger.info('Redis connected');
    return redis;
  } catch (error) {
    if (!allowMemoryFallback) {
      redis.disconnect();
      throw error;
    }
    logger.warn(
      { err: (error as Error).message },
      'Could not connect to Redis/Docker. Falling back to built-in in-memory store.',
    );
    redis.disconnect();
    const mem = new InMemoryRedis(keyPrefix);
    client = mem;
    return mem as unknown as Redis;
  }
}

export function getRedis(): Redis {
  if (!client) throw new Error('Redis / in-memory store is not initialized');
  return client as unknown as Redis;
}

export function isRedisReady(): boolean {
  return client?.status === 'ready';
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  current.removeAllListeners('error');
  await current.quit();
}
