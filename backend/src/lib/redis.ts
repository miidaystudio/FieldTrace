import { Redis } from 'ioredis';
import { logger } from './logger.js';

let client: Redis | null = null;

/**
 * Connects the shared Redis client. All keys are namespaced with `keyPrefix` (ioredis applies it
 * to command keys AND to `KEYS[]` of Lua scripts), so FieldTrace can share a Redis instance.
 */
export async function connectRedis(url: string, keyPrefix: string): Promise<Redis> {
  const redis = new Redis(url, {
    keyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
  });
  redis.on('error', (error) => logger.error({ err: error }, 'Redis error'));
  redis.on('reconnecting', () => logger.warn('Redis reconnecting'));
  await redis.connect();
  client = redis;
  logger.info('Redis connected');
  return redis;
}

export function getRedis(): Redis {
  if (!client) throw new Error('Redis is not connected');
  return client;
}

export function isRedisReady(): boolean {
  return client?.status === 'ready';
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  const redis = client;
  client = null;
  redis.removeAllListeners('error');
  await redis.quit();
}
