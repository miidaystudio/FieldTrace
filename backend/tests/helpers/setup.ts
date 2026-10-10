import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { afterAll, beforeAll, inject } from 'vitest';
// Importing the app registers every Mongoose model before collections/indexes are created.
import '../../src/app.js';
import { initModels } from '../../src/lib/db.js';
import { connectRedis, disconnectRedis } from '../../src/lib/redis.js';

/**
 * Tests use the real Docker Redis (GEO + Lua are needed), isolated by database index 15 and a
 * unique key prefix per test file. Override with TEST_REDIS_URL.
 */
const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6380/15';
const redisPrefix = `ft-test-${randomUUID().slice(0, 8)}:`;

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'), { dbName: `ft_test_${randomUUID().slice(0, 8)}` });
  await initModels();
  try {
    await connectRedis(TEST_REDIS_URL, redisPrefix);
  } catch (error) {
    throw new Error(
      `Tests need Redis at ${TEST_REDIS_URL}. Start it with: docker start fieldtrace-redis ` +
        `(see backend/README.md). Cause: ${(error as Error).message}`,
      { cause: error },
    );
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await disconnectRedis();
  // Remove this file's keys (raw client: SCAN/DEL must not be re-prefixed).
  const raw = new Redis(TEST_REDIS_URL);
  const keys: string[] = [];
  for await (const batch of raw.scanStream({ match: `${redisPrefix}*`, count: 500 })) {
    keys.push(...(batch as string[]));
  }
  if (keys.length > 0) await raw.del(...keys);
  await raw.quit();
});
