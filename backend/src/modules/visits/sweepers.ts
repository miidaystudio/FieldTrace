import { logger } from '../../lib/logger.js';
import { getRedis } from '../../lib/redis.js';
import { idString } from '../../shared/schemas.js';
import { AgentProfile } from '../agents/agent.model.js';
import { Assignment } from '../assignments/assignment.model.js';
import { systemTransition } from '../assignments/assignment.service.js';
import { getOrgSettings, orgDayOf } from '../organizations/settings-cache.js';
import { finalizePresence } from './geofence-engine.js';
import { listPresences } from './presence.js';
import { recordMissedVisit } from './visit.service.js';

const LOCK_KEY = 'lock:assignment-sweep';
const BATCH = 500;

/**
 * Deadline handling (system actor, idempotent):
 *  - `pending` assignments whose deadline or time window has passed → `overdue`;
 *  - `pending`/`overdue` assignments of a day that is over in the org's timezone → a `missed`
 *    visit is recorded once (they stay `overdue` for a manager to cancel or reassign).
 */
export async function runAssignmentSweep(
  now = new Date(),
): Promise<{ overdue: number; missed: number }> {
  let overdue = 0;
  let missed = 0;

  // System job across organizations: explicit opt-out of the tenancy guard.
  const late = await Assignment.find({
    status: 'pending',
    $or: [{ deadline: { $lt: now } }, { 'window.end': { $lt: now } }],
  })
    .setOptions({ skipTenantCheck: true })
    .limit(BATCH)
    .select('_id orgId')
    .lean();
  for (const assignment of late) {
    const moved = await systemTransition(
      idString(assignment.orgId),
      assignment._id,
      ['pending'],
      'overdue',
      'Deadline passed without a visit',
    );
    if (moved) overdue += 1;
  }

  // Candidates whose day may be over somewhere (UTC tomorrow covers every timezone). Only the
  // last week is scanned so already-handled old assignments cannot starve newer ones.
  const horizon = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const oldest = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const stale = await Assignment.find({
    status: { $in: ['pending', 'overdue'] },
    scheduledDate: { $lt: horizon, $gte: oldest },
  })
    .setOptions({ skipTenantCheck: true })
    .limit(BATCH)
    .lean();
  for (const assignment of stale) {
    const orgId = idString(assignment.orgId);
    if (assignment.scheduledDate >= (await orgDayOf(orgId, now))) continue;
    if (assignment.status === 'pending') {
      await systemTransition(
        orgId,
        assignment._id,
        ['pending'],
        'overdue',
        'Scheduled day ended without a visit',
      );
    }
    if (await recordMissedVisit(orgId, assignment)) missed += 1;
  }
  return { overdue, missed };
}

/** Closes stays whose agent stopped reporting while inside a geofence (flagged `signal_lost`). */
export async function sweepStalePresences(orgId: string, nowMs = Date.now()): Promise<number> {
  const { offlineAfterSec } = await getOrgSettings(orgId);
  const presences = await listPresences(orgId);
  const staleIds = [...presences.entries()]
    .filter(([, presence]) => nowMs - presence.lastInsideAt > offlineAfterSec * 1000)
    .map(([agentId]) => agentId);
  if (staleIds.length === 0) return 0;
  const profiles = await AgentProfile.find({ orgId, _id: { $in: staleIds } })
    .select('_id teamId')
    .lean();
  for (const profile of profiles) await finalizePresence(orgId, profile, 'signal_lost');
  return profiles.length;
}

export function startAssignmentSweeper(intervalSec = 60): () => void {
  const intervalMs = intervalSec * 1000;
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    getRedis()
      .set(LOCK_KEY, '1', 'PX', Math.max(1000, intervalMs - 250), 'NX')
      .then((acquired) => (acquired === 'OK' ? runAssignmentSweep() : null))
      .catch((error: unknown) => logger.error({ err: error }, 'Assignment sweep failed'))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
