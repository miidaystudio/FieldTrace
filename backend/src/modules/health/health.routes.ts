import { isDatabaseReady } from '../../lib/db.js';
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
  summary: 'Readiness probe — dependencies (MongoDB) are reachable',
  auth: 'public',
  response: z.object({ status: z.literal('ready'), mongo: z.literal('connected') }),
  errors: [503],
  handler: () => {
    if (!isDatabaseReady()) {
      return Promise.reject(
        new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Database is not connected'),
      );
    }
    return Promise.resolve({ data: { status: 'ready' as const, mongo: 'connected' as const } });
  },
});
