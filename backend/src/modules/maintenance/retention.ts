import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { getRedis } from '../../lib/redis.js';
import { idString } from '../../shared/schemas.js';
import { AuditLog } from '../audit/audit.model.js';
import { Notification } from '../notifications/notification.model.js';
import { Organization } from '../organizations/organization.model.js';
import { LocationTelemetry } from '../tracking/telemetry.model.js';

const DAY_MS = 86_400_000;
const LOCK_KEY = 'lock:retention';

export interface RetentionResult {
  telemetry: number;
  auditLogs: number;
  notifications: number;
}

/**
 * Enforces data retention:
 * - raw telemetry older than each organization's `telemetryRetentionDays` (the collection-wide
 *   TTL `TELEMETRY_RETENTION_DAYS` remains the upper bound);
 * - audit logs older than `AUDIT_RETENTION_DAYS` (0 = keep forever);
 * - in-app notifications older than `NOTIFICATION_RETENTION_DAYS`.
 */
export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const result: RetentionResult = { telemetry: 0, auditLogs: 0, notifications: 0 };
  // System job across organizations.
  const orgs = await Organization.find({}).select('_id settings.telemetryRetentionDays').lean();
  for (const org of orgs) {
    const orgId = idString(org._id);
    try {
      const days = org.settings.telemetryRetentionDays;
      if (days < env.TELEMETRY_RETENTION_DAYS) {
        const cutoff = new Date(now.getTime() - days * DAY_MS);
        const res = await LocationTelemetry.deleteMany({
          'meta.orgId': org._id,
          recordedAt: { $lt: cutoff },
        });
        result.telemetry += res.deletedCount;
      }
      if (env.AUDIT_RETENTION_DAYS > 0) {
        const cutoff = new Date(now.getTime() - env.AUDIT_RETENTION_DAYS * DAY_MS);
        result.auditLogs += (
          await AuditLog.deleteMany({ orgId, at: { $lt: cutoff } })
        ).deletedCount;
      }
      const notifyCutoff = new Date(now.getTime() - env.NOTIFICATION_RETENTION_DAYS * DAY_MS);
      result.notifications += (
        await Notification.deleteMany({ orgId, createdAt: { $lt: notifyCutoff } })
      ).deletedCount;
    } catch (error) {
      logger.error({ err: error, orgId }, 'Retention failed for organization');
    }
  }
  if (result.telemetry + result.auditLogs + result.notifications > 0) {
    logger.info(result, 'Retention removed old data');
  }
  return result;
}

/** Runs every few hours on one instance (Redis lock). */
export function startRetention(intervalSec = 6 * 3600): () => void {
  const intervalMs = intervalSec * 1000;
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    getRedis()
      .set(LOCK_KEY, '1', 'PX', Math.max(1000, intervalMs - 1000), 'NX')
      .then((acquired) => (acquired === 'OK' ? runRetention() : null))
      .catch((error: unknown) => logger.error({ err: error }, 'Retention job failed'))
      .finally(() => {
        running = false;
      });
  };
  const first = setTimeout(tick, 60_000);
  first.unref();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
