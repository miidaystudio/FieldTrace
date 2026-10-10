import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './lib/db.js';
import { logger } from './lib/logger.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { startStatusSweeper } from './modules/tracking/status-sweeper.js';
import { startAssignmentSweeper } from './modules/visits/sweepers.js';
import { closeRealtime, initRealtime } from './realtime/io.js';

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  await connectRedis(env.REDIS_URL, env.REDIS_KEY_PREFIX);

  const server = createServer(createApp());
  const io = initRealtime(server);
  const stopSweeper = startStatusSweeper(env.STATUS_SWEEP_INTERVAL_SEC);
  const stopAssignmentSweeper = startAssignmentSweeper(60);

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, docs: `http://localhost:${env.PORT}/api/docs` },
      'FieldTrace API listening (HTTP + Socket.IO)',
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const forceExit = setTimeout(() => process.exit(1), 10_000).unref();
    stopSweeper();
    stopAssignmentSweeper();
    // io.close() also closes the underlying HTTP server.
    closeRealtime(io)
      .then(() => Promise.all([disconnectRedis(), disconnectDatabase()]))
      .then(() => {
        clearTimeout(forceExit);
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
