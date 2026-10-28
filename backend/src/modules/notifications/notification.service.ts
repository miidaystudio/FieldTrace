import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { pageMeta, skipFor } from '../../lib/pagination.js';
import { getRedis } from '../../lib/redis.js';
import { publishNotification } from '../../realtime/publisher.js';
import { SEVERITIES, type Severity } from '../../shared/enums.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { recordAudit } from '../audit/audit.service.js';
import { Team } from '../teams/team.model.js';
import { User, notificationPrefsOf } from '../users/user.model.js';
import {
  Notification,
  WebhookConfig,
  WebhookDelivery,
  type Delivery,
  type NotificationDoc,
  type NotificationKind,
  type WebhookConfigDoc,
} from './notification.model.js';
import type {
  ListNotificationsQuery,
  NotificationDto,
  NotificationPrefsDto,
  PutWebhookBody,
  UpdateNotificationPrefsBody,
  WebhookConfigDto,
} from './notification.schemas.js';
import { checkWebhookUrl, postWebhook, sendEmail } from './transports.js';

export const MAX_ATTEMPTS = 5;
const BATCH = 50;
const LOCK_KEY = 'lock:notification-dispatch';

const rank = (severity: Severity) => SEVERITIES.indexOf(severity);
const pending = (): Delivery => ({
  status: 'pending',
  attempts: 0,
  nextAttemptAt: null,
  lastError: null,
  sentAt: null,
});
const skipped = (): Delivery => ({ ...pending(), status: 'skipped' });

export function toNotificationDto(doc: NotificationDoc): NotificationDto {
  return {
    id: idString(doc._id),
    kind: doc.kind,
    severity: doc.severity,
    title: doc.title,
    body: doc.body,
    link: doc.link,
    entityType: doc.entityType,
    entityId: doc.entityId ? idString(doc.entityId) : null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    emailStatus: doc.email.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

// ------------------------------------------------------------------ creating

export interface NotifyInput {
  kind: NotificationKind;
  severity: Severity;
  title: string;
  body: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: Types.ObjectId | string | null;
  /** Team the subject belongs to: its managers are notified (admins always are). */
  teamId: Types.ObjectId | string | null;
  /** Webhook event name and payload (defaults to the notification fields). */
  event?: string;
  data?: Record<string, unknown>;
}

/**
 * Fan-out of one event to the people responsible for it: active admins plus the managers of the
 * subject's team, each according to their preferences. Creates in-app notifications (pushed live
 * as `notification:created`), queues emails, and queues the organization webhook. Never throws —
 * notifications must not break the operation that triggered them.
 */
export async function notify(orgId: string, input: NotifyInput): Promise<number> {
  try {
    const managerIds = input.teamId
      ? ((await Team.findOne({ orgId, _id: input.teamId }).select('managerIds').lean())
          ?.managerIds ?? [])
      : [];
    const recipients = await User.find({
      orgId,
      status: 'active',
      $or: [{ role: 'admin' }, { role: 'manager', _id: { $in: managerIds } }],
    })
      .select('_id notificationPrefs')
      .lean();

    const docs = recipients.flatMap((user) => {
      const prefs = notificationPrefsOf(user);
      if (input.kind !== 'test' && !prefs.events[input.kind]) return [];
      const email =
        prefs.email.enabled && rank(input.severity) >= rank(prefs.email.minSeverity)
          ? pending()
          : skipped();
      return [
        {
          orgId,
          userId: user._id,
          kind: input.kind,
          severity: input.severity,
          title: input.title,
          body: input.body,
          link: input.link ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          readAt: null,
          email,
        },
      ];
    });
    if (docs.length > 0) {
      const created = await Notification.insertMany(docs);
      for (const doc of created) {
        publishNotification(orgId, idString(doc.userId), toNotificationDto(doc.toObject()));
      }
    }
    await queueWebhook(orgId, input);
    return docs.length;
  } catch (error) {
    logger.error({ err: error, kind: input.kind }, 'Failed to create notifications');
    return 0;
  }
}

async function queueWebhook(orgId: string, input: NotifyInput): Promise<void> {
  const config = await WebhookConfig.findOne({ orgId, enabled: true }).lean();
  if (!config || rank(input.severity) < rank(config.minSeverity)) return;
  const event = input.event ?? `notification.${input.kind}`;
  await WebhookDelivery.create({
    orgId,
    event,
    payload: {
      id: randomBytes(12).toString('hex'),
      type: event,
      createdAt: new Date().toISOString(),
      organizationId: orgId,
      severity: input.severity,
      title: input.title,
      body: input.body,
      link: input.link ? `${env.APP_URL}${input.link}` : null,
      data: input.data ?? {},
    },
    delivery: pending(),
  });
}

// ------------------------------------------------------------------ dispatching (outbox)

function backoffMs(attempts: number): number {
  return Math.min(60, 2 ** (attempts - 1)) * 60_000; // 1, 2, 4, 8 min …
}

function failure(delivery: Delivery, error: unknown, now: Date): Partial<Delivery> {
  const attempts = delivery.attempts + 1;
  const message = error instanceof Error ? error.message : String(error);
  return attempts >= MAX_ATTEMPTS
    ? { status: 'failed', attempts, nextAttemptAt: null, lastError: message.slice(0, 500) }
    : {
        status: 'pending',
        attempts,
        nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
        lastError: message.slice(0, 500),
      };
}

const due = (field: string, now: Date) => ({
  [`${field}.status`]: 'pending',
  $or: [{ [`${field}.nextAttemptAt`]: null }, { [`${field}.nextAttemptAt`]: { $lte: now } }],
});

function emailContent(doc: NotificationDoc) {
  const link = doc.link ? `${env.APP_URL}${doc.link}` : env.APP_URL;
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return {
    subject: `[FieldTrace] ${doc.severity === 'high' ? 'HIGH · ' : ''}${doc.title}`,
    text: `${doc.title}\n\n${doc.body}\n\nOpen: ${link}\n\nYou can change notification settings in FieldTrace → Settings.`,
    html:
      `<p><strong>${escape(doc.title)}</strong></p><p>${escape(doc.body)}</p>` +
      `<p><a href="${escape(link)}">Open in FieldTrace</a></p>` +
      '<p style="color:#888;font-size:12px">Change notification settings in FieldTrace → Settings.</p>',
  };
}

/**
 * Sends due emails and webhooks with retries (1, 2, 4, 8 min; failed after 5 attempts). Safe to
 * run on several instances: each item is claimed atomically before sending.
 */
export async function runDispatch(now = new Date()): Promise<{ emails: number; webhooks: number }> {
  let emails = 0;
  let webhooks = 0;

  // System job across organizations.
  const dueEmails = await Notification.find(due('email', now))
    .setOptions({ skipTenantCheck: true })
    .limit(BATCH)
    .lean();
  for (const doc of dueEmails) {
    // Claim: push nextAttemptAt forward so a parallel run skips it.
    const claimed = await Notification.findOneAndUpdate(
      {
        _id: doc._id,
        orgId: doc.orgId,
        'email.status': 'pending',
        'email.attempts': doc.email.attempts,
      },
      { $set: { 'email.nextAttemptAt': new Date(now.getTime() + 5 * 60_000) } },
    ).lean();
    if (!claimed) continue;
    let update: Partial<Delivery>;
    try {
      const user = await User.findOne({ orgId: doc.orgId, _id: doc.userId, status: 'active' })
        .select('email')
        .lean();
      if (!user) update = { status: 'skipped', nextAttemptAt: null };
      else {
        const status = await sendEmail({ to: user.email, ...emailContent(doc) });
        update = {
          status,
          attempts: doc.email.attempts + 1,
          nextAttemptAt: null,
          sentAt: new Date(),
        };
        emails += 1;
      }
    } catch (error) {
      update = failure(doc.email, error, now);
    }
    await Notification.updateOne(
      { _id: doc._id, orgId: doc.orgId },
      { $set: Object.fromEntries(Object.entries(update).map(([k, v]) => [`email.${k}`, v])) },
    );
  }

  const dueHooks = await WebhookDelivery.find(due('delivery', now))
    .setOptions({ skipTenantCheck: true })
    .limit(BATCH)
    .lean();
  for (const hook of dueHooks) {
    const claimed = await WebhookDelivery.findOneAndUpdate(
      {
        _id: hook._id,
        orgId: hook.orgId,
        'delivery.status': 'pending',
        'delivery.attempts': hook.delivery.attempts,
      },
      { $set: { 'delivery.nextAttemptAt': new Date(now.getTime() + 5 * 60_000) } },
    ).lean();
    if (!claimed) continue;
    let update: Partial<Delivery>;
    let responseStatus: number | null = null;
    try {
      const config = await WebhookConfig.findOne({ orgId: hook.orgId, enabled: true }).lean();
      if (!config) update = { status: 'skipped', nextAttemptAt: null };
      else {
        responseStatus = await postWebhook(config.url, config.secret, hook.event, hook.payload);
        update = {
          status: 'sent',
          attempts: hook.delivery.attempts + 1,
          nextAttemptAt: null,
          sentAt: new Date(),
        };
        webhooks += 1;
      }
    } catch (error) {
      update = failure(hook.delivery, error, now);
    }
    await WebhookDelivery.updateOne(
      { _id: hook._id, orgId: hook.orgId },
      {
        $set: {
          ...Object.fromEntries(Object.entries(update).map(([k, v]) => [`delivery.${k}`, v])),
          responseStatus,
        },
      },
    );
  }
  return { emails, webhooks };
}

export function startNotificationDispatcher(intervalSec = 15): () => void {
  const intervalMs = intervalSec * 1000;
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    getRedis()
      .set(LOCK_KEY, '1', 'PX', Math.max(1000, intervalMs - 250), 'NX')
      .then((acquired) => (acquired === 'OK' ? runDispatch() : null))
      .catch((error: unknown) => logger.error({ err: error }, 'Notification dispatch failed'))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

// ------------------------------------------------------------------ inbox

export async function listMyNotifications(actor: Actor, query: ListNotificationsQuery) {
  const filter: Record<string, unknown> = {
    orgId: toObjectId(actor.orgId),
    userId: toObjectId(actor.userId),
  };
  if (query.unread !== undefined) filter.readAt = query.unread ? null : { $ne: null };
  const [docs, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);
  return { data: docs.map(toNotificationDto), meta: pageMeta(query.page, query.limit, total) };
}

export async function unreadCount(actor: Actor): Promise<number> {
  return Notification.countDocuments({ orgId: actor.orgId, userId: actor.userId, readAt: null });
}

export async function markRead(actor: Actor, id: string): Promise<NotificationDto> {
  const filter = { _id: id, orgId: actor.orgId, userId: actor.userId };
  // Keeps the first read time when called twice.
  await Notification.updateOne({ ...filter, readAt: null }, { $set: { readAt: new Date() } });
  const doc = await Notification.findOne(filter).lean();
  if (!doc) throw notFound('Notification');
  return toNotificationDto(doc);
}

export async function markAllRead(actor: Actor): Promise<number> {
  const res = await Notification.updateMany(
    { orgId: actor.orgId, userId: actor.userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return res.modifiedCount;
}

// ------------------------------------------------------------------ preferences

export async function getPrefs(actor: Actor): Promise<NotificationPrefsDto> {
  const user = await User.findOne({ _id: actor.userId, orgId: actor.orgId })
    .select('notificationPrefs')
    .lean();
  if (!user) throw notFound('User');
  return notificationPrefsOf(user);
}

export async function updatePrefs(
  actor: Actor,
  body: UpdateNotificationPrefsBody,
): Promise<NotificationPrefsDto> {
  const current = await getPrefs(actor);
  const next: NotificationPrefsDto = {
    events: { ...current.events, ...body.events },
    email: { ...current.email, ...body.email },
  };
  await User.updateOne(
    { _id: actor.userId, orgId: actor.orgId },
    { $set: { notificationPrefs: next } },
  );
  return next;
}

// ------------------------------------------------------------------ webhook (admin)

const newSecret = () => `whsec_${randomBytes(24).toString('base64url')}`;

function toWebhookDto(doc: WebhookConfigDoc, revealSecret: boolean): WebhookConfigDto {
  return {
    url: doc.url,
    enabled: doc.enabled,
    minSeverity: doc.minSeverity,
    secretHint: doc.secret.slice(-4),
    ...(revealSecret ? { secret: doc.secret } : {}),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getWebhook(actor: Actor): Promise<WebhookConfigDto> {
  const doc = await WebhookConfig.findOne({ orgId: actor.orgId }).lean();
  if (!doc) throw notFound('Webhook');
  return toWebhookDto(doc, false);
}

/** Creates or updates the webhook. The signing secret is generated once and returned once. */
export async function putWebhook(actor: Actor, body: PutWebhookBody): Promise<WebhookConfigDto> {
  const problem = await checkWebhookUrl(body.url);
  if (problem) throw badRequest(`url ${problem}`);
  const existing = await WebhookConfig.findOne({ orgId: actor.orgId }).lean();
  const doc = existing
    ? await WebhookConfig.findOneAndUpdate(
        { _id: existing._id, orgId: actor.orgId },
        { $set: { url: body.url, enabled: body.enabled, minSeverity: body.minSeverity } },
        { returnDocument: 'after' },
      ).lean()
    : (await WebhookConfig.create({ orgId: actor.orgId, ...body, secret: newSecret() })).toObject();
  await recordAudit(actor, {
    action: existing ? 'webhook.updated' : 'webhook.created',
    entityType: 'organization',
    entityId: actor.orgId,
    metadata: { url: body.url, enabled: body.enabled, minSeverity: body.minSeverity },
  });
  return toWebhookDto(doc!, !existing);
}

export async function rotateWebhookSecret(actor: Actor): Promise<WebhookConfigDto> {
  const doc = await WebhookConfig.findOneAndUpdate(
    { orgId: actor.orgId },
    { $set: { secret: newSecret() } },
    { returnDocument: 'after' },
  ).lean();
  if (!doc) throw notFound('Webhook');
  await recordAudit(actor, {
    action: 'webhook.secret_rotated',
    entityType: 'organization',
    entityId: actor.orgId,
  });
  return toWebhookDto(doc, true);
}

export async function deleteWebhook(actor: Actor): Promise<void> {
  const res = await WebhookConfig.deleteOne({ orgId: actor.orgId });
  if (res.deletedCount === 0) throw notFound('Webhook');
  await recordAudit(actor, {
    action: 'webhook.deleted',
    entityType: 'organization',
    entityId: actor.orgId,
  });
}

/** Sends a signed test event right away and reports the receiver's answer. */
export async function testWebhook(actor: Actor) {
  const doc = await WebhookConfig.findOne({ orgId: actor.orgId }).lean();
  if (!doc) throw notFound('Webhook');
  try {
    const status = await postWebhook(doc.url, doc.secret, 'webhook.test', {
      id: randomBytes(12).toString('hex'),
      type: 'webhook.test',
      createdAt: new Date().toISOString(),
      organizationId: actor.orgId,
      data: { message: 'Test event from FieldTrace' },
    });
    return { ok: true, status, error: null };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listWebhookDeliveries(actor: Actor) {
  const docs = await WebhookDelivery.find({ orgId: actor.orgId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return docs.map((doc) => ({
    id: idString(doc._id),
    event: doc.event,
    status: doc.delivery.status,
    attempts: doc.delivery.attempts,
    responseStatus: doc.responseStatus,
    lastError: doc.delivery.lastError,
    createdAt: doc.createdAt.toISOString(),
    sentAt: doc.delivery.sentAt ? doc.delivery.sentAt.toISOString() : null,
  }));
}
