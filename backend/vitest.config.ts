import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/helpers/global-setup.ts'],
    setupFiles: ['tests/helpers/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Values below are test-only; real configuration comes from `.env`.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      MONGODB_URI: 'mongodb://placeholder-replaced-by-memory-server',
      JWT_ACCESS_SECRET: 'test-only-secret-not-used-anywhere-else-0123456789',
      AUTH_RATE_LIMIT_PER_MIN: '10000',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
