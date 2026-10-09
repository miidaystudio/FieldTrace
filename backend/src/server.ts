import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './lib/db.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);

  const server = createServer(createApp());
  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, docs: `http://localhost:${env.PORT}/api/docs` },
      'FieldTrace API listening',
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const forceExit = setTimeout(() => process.exit(1), 10_000).unref();
    server.close(() => {
      disconnectDatabase()
        .then(() => {
          clearTimeout(forceExit);
          process.exit(0);
        })
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Error during shutdown');
          process.exit(1);
        });
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server');
  process.exit(1);
});
