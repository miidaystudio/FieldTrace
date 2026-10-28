import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load `.env` with Node's built-in loader (no dotenv dependency). Variables already present
// in the real environment win, because loadEnvFile does not override existing keys.
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI'),
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  REDIS_URL: z
    .string()
    .refine((val) => val === 'memory' || /^rediss?:\/\//.test(val), {
      message: "must be 'memory' or a redis:// / rediss:// URI",
    })
    .default('memory'),
  /** Prefix for every Redis key, so several apps/environments can share one Redis safely. */
  REDIS_KEY_PREFIX: z.string().max(40).default('ft:'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  COOKIE_SECURE: booleanString.default(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(10),

  // --- Telemetry ingestion (Phase 2) ---
  /** Max GPS samples accepted in one POST /telemetry request. */
  TELEMETRY_MAX_BATCH: z.coerce.number().int().min(1).max(500).default(50),
  /** Samples older than this (relative to server time) are rejected as `too_old`. */
  TELEMETRY_MAX_AGE_SEC: z.coerce.number().int().min(60).default(86_400),
  /** Tolerated device clock skew into the future before a sample is rejected. */
  TELEMETRY_MAX_FUTURE_SKEW_SEC: z.coerce.number().int().min(0).max(3600).default(120),
  /** Collection-level TTL for raw location history (MongoDB time-series expireAfterSeconds). */
  TELEMETRY_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  /** How often agent connectivity (online/stale/offline) is re-evaluated. */
  STATUS_SWEEP_INTERVAL_SEC: z.coerce.number().int().min(1).max(300).default(15),

  // ---- Phase 5: retention
  /** Delete audit logs older than this many days; 0 keeps them forever. */
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(0).max(3650).default(0),
  /** Delete in-app notifications older than this many days. */
  NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),

  // ---- Phase 5: route optimization
  /** OpenRouteService key. Without it the built-in optimizer (straight-line estimates) is used. */
  ORS_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  ORS_BASE_URL: z.url().default('https://api.openrouteservice.org'),
  /** Built-in optimizer: average door-to-door speed and straight-line → road distance factor. */
  ROUTING_AVG_SPEED_KMH: z.coerce.number().min(5).max(120).default(25),
  ROUTING_ROAD_FACTOR: z.coerce.number().min(1).max(3).default(1.3),

  // ---- Phase 5: notifications
  /** Resend API key for email. Without it emails are only logged (development). */
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  EMAIL_FROM: z.string().min(3).default('FieldTrace <alerts@fieldtrace.local>'),
  /** Public dashboard URL used in email links. */
  APP_URL: z.url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const result = parsed.data;
  if (result.NODE_ENV === 'production' && !result.COOKIE_SECURE) {
    throw new Error(
      'Invalid environment configuration: COOKIE_SECURE=true is required in production (HTTPS)',
    );
  }
  if (result.COOKIE_SAMESITE === 'none' && !result.COOKIE_SECURE) {
    throw new Error(
      'Invalid environment configuration: COOKIE_SAMESITE=none requires COOKIE_SECURE=true',
    );
  }
  if (result.NODE_ENV === 'production' && result.REDIS_URL === 'memory') {
    throw new Error(
      'Invalid environment configuration: REDIS_URL=memory is not allowed in production',
    );
  }
  return result;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
