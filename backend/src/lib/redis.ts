import { Redis } from 'ioredis';
import { InMemoryRedis } from './in-memory-redis.js';
import { logger } from './logger.js';

let client: Redis | InMemoryRedis | null = null;

/**
 * Connects the Redis client or initializes the built-in in-memory store.
 * If url is 'memory' or the external Redis is unreachable, FieldTrace seamlessly
 * runs in-memory with zero Docker/Redis dependency.
 */
export async function connectRedis(url: string, keyPrefix: string): Promise<Redis> {
  if (url === 'memory') {
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

