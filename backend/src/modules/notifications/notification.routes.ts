import { createModuleRouter } from '../../lib/route.js';
import { z } from '../../lib/zod.js';
import { idParams } from '../../shared/schemas.js';
import {
  listNotificationsQuery,
  notificationDto,
  notificationPrefsDto,
  putWebhookBody,
  updateNotificationPrefsBody,
  webhookConfigDto,
  webhookDeliveryDto,
  webhookTestDto,
} from './notification.schemas.js';
import {
  deleteWebhook,
  getPrefs,
  getWebhook,
  listMyNotifications,
  listWebhookDeliveries,
  markAllRead,
  markRead,
  putWebhook,
  rotateWebhookSecret,
  testWebhook,
  unreadCount,
  updatePrefs,
} from './notification.service.js';

const STAFF = ['admin', 'manager'] as const;

export const notificationRoutes = createModuleRouter({
  basePath: '/notifications',
  tag: 'Notifications',
});

notificationRoutes.route({
  method: 'get',
  path: '/',
  summary: 'My notifications (newest first)',
  description:
    'Admins get every alert of the organization, managers those of their teams. Pushed live as ' +
    '`notification:created`. `unread=true` filters to unread.',
  auth: [...STAFF],
  query: listNotificationsQuery,
  response: notificationDto,
  list: true,
  handler: ({ actor, query }) => listMyNotifications(actor, query),
});

// Literal segments are registered before `/:id`.
notificationRoutes.route({
  method: 'get',
  path: '/unread-count',
  summary: 'Number of unread notifications (badge)',
  auth: [...STAFF],
  response: z.object({ unread: z.number().int() }),
  handler: async ({ actor }) => ({ data: { unread: await unreadCount(actor) } }),
});

notificationRoutes.route({
  method: 'post',
  path: '/read-all',
  summary: 'Mark all my notifications as read',
  auth: [...STAFF],
  response: z.object({ updated: z.number().int() }),
  handler: async ({ actor }) => ({ data: { updated: await markAllRead(actor) } }),
});

notificationRoutes.route({
  method: 'get',
  path: '/preferences',
  summary: 'My notification preferences',
  auth: [...STAFF],
  response: notificationPrefsDto,
  handler: async ({ actor }) => ({ data: await getPrefs(actor) }),
});

notificationRoutes.route({
  method: 'patch',
  path: '/preferences',
  summary: 'Update my notification preferences',
  description: 'Choose which events notify you and from which severity they are also emailed.',
  auth: [...STAFF],
  body: updateNotificationPrefsBody,
  response: notificationPrefsDto,
  handler: async ({ actor, body }) => ({ data: await updatePrefs(actor, body) }),
});

notificationRoutes.route({
  method: 'get',
  path: '/webhook',
  summary: 'Organization webhook (secret hidden)',
  auth: ['admin'],
  response: webhookConfigDto,
  handler: async ({ actor }) => ({ data: await getWebhook(actor) }),
});

notificationRoutes.route({
  method: 'put',
  path: '/webhook',
  summary: 'Create or update the organization webhook (audited)',
  description:
    'Every notification at or above `minSeverity` is POSTed as JSON with headers ' +
    '`X-FieldTrace-Event`, `X-FieldTrace-Timestamp` and `X-FieldTrace-Signature: sha256=<hmac>` ' +
    'over `${timestamp}.${body}`. The secret is returned only when the webhook is created. In ' +
    'production the URL must be HTTPS and must not resolve to a private address.',
  auth: ['admin'],
  body: putWebhookBody,
  response: webhookConfigDto,
  handler: async ({ actor, body }) => ({ data: await putWebhook(actor, body) }),
});

notificationRoutes.route({
  method: 'delete',
  path: '/webhook',
  summary: 'Remove the organization webhook (audited)',
  auth: ['admin'],
  handler: async ({ actor }) => {
    await deleteWebhook(actor);
  },
});

notificationRoutes.route({
  method: 'post',
  path: '/webhook/rotate-secret',
  summary: 'Generate a new signing secret (returned once, audited)',
  auth: ['admin'],
  response: webhookConfigDto,
  handler: async ({ actor }) => ({ data: await rotateWebhookSecret(actor) }),
});

notificationRoutes.route({
  method: 'post',
  path: '/webhook/test',
  summary: 'Send a signed test event now',
  auth: ['admin'],
  response: webhookTestDto,
  handler: async ({ actor }) => ({ data: await testWebhook(actor) }),
});

notificationRoutes.route({
  method: 'get',
  path: '/webhook/deliveries',
  summary: 'Last 50 webhook deliveries (kept 30 days)',
  auth: ['admin'],
  response: z.array(webhookDeliveryDto),
  handler: async ({ actor }) => ({ data: await listWebhookDeliveries(actor) }),
});

notificationRoutes.route({
  method: 'post',
  path: '/:id/read',
  summary: 'Mark one notification as read',
  auth: [...STAFF],
  params: idParams,
  response: notificationDto,
  handler: async ({ actor, params }) => ({ data: await markRead(actor, params.id) }),
});
