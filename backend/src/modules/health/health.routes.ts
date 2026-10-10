import { isDatabaseReady } from '../../lib/db.js';
import { isRedisReady } from '../../lib/redis.js';
import { AppError, ErrorCode } from '../../lib/errors.js';
import { createModuleRouter } from '../../lib/route.js';
import { z } from '../../lib/zod.js';

export const healthRoutes = createModuleRouter({ basePath: '', tag: 'Health' });

healthRoutes.route({
  method: 'get',
  path: '/health',
  summary: 'Liveness probe — the process is up',
  auth: 'public',
  response: z.object({ status: z.literal('ok'), uptimeSec: z.number() }),
  handler: () =>
    Promise.resolve({ data: { status: 'ok' as const, uptimeSec: Math.round(process.uptime()) } }),
});

healthRoutes.route({
  method: 'get',
  path: '/ready',
  summary: 'Readiness probe — dependencies (MongoDB, Redis) are reachable',
  auth: 'public',
  response: z.object({
    status: z.literal('ready'),
    mongo: z.literal('connected'),
    redis: z.literal('connected'),
  }),
  errors: [503],
  handler: () => {
    if (!isDatabaseReady() || !isRedisReady()) {
      const down = [!isDatabaseReady() && 'MongoDB', !isRedisReady() && 'Redis'].filter(Boolean);
      return Promise.reject(
        new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, `Not connected: ${down.join(', ')}`),
      );
    }
    return Promise.resolve({
      data: { status: 'ready' as const, mongo: 'connected' as const, redis: 'connected' as const },
    });
  },
});
