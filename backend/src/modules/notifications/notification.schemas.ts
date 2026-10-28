import { paginationQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import { SEVERITIES } from '../../shared/enums.js';
import { isoDateTime, objectIdSchema, queryBoolean } from '../../shared/schemas.js';
import { DELIVERY_STATUSES, NOTIFICATION_KINDS } from './notification.model.js';

export const notificationDto = z
  .object({
    id: objectIdSchema,
    kind: z.enum(NOTIFICATION_KINDS),
    severity: z.enum(SEVERITIES),
    title: z.string(),
    body: z.string(),
    link: z.string().nullable().openapi({ description: 'Dashboard path to open.' }),
    entityType: z.string().nullable(),
    entityId: objectIdSchema.nullable(),
    readAt: isoDateTime.nullable(),
    emailStatus: z.enum(DELIVERY_STATUSES),
    createdAt: isoDateTime,
  })
  .openapi('Notification');
export type NotificationDto = z.infer<typeof notificationDto>;

export const listNotificationsQuery = paginationQuery.extend({
  unread: queryBoolean.optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;

export const notificationPrefsDto = z
  .object({
    events: z.object({ anomaly: z.boolean(), assignment_overdue: z.boolean() }),
    email: z.object({
      enabled: z.boolean(),
      minSeverity: z
        .enum(SEVERITIES)
        .openapi({ description: 'Only notifications at or above this severity are emailed.' }),
    }),
  })
  .openapi('NotificationPreferences');
export type NotificationPrefsDto = z.infer<typeof notificationPrefsDto>;

export const updateNotificationPrefsBody = z
  .object({
    events: notificationPrefsDto.shape.events.partial().strict().optional(),
    email: notificationPrefsDto.shape.email.partial().strict().optional(),
  })
  .strict()
  .openapi('UpdateNotificationPreferencesRequest');
export type UpdateNotificationPrefsBody = z.infer<typeof updateNotificationPrefsBody>;

export const webhookConfigDto = z
  .object({
    url: z.string(),
    enabled: z.boolean(),
    minSeverity: z.enum(SEVERITIES),
    secretHint: z.string().openapi({ description: 'Last 4 characters of the signing secret.' }),
    /** Only present right after the secret was created or rotated. */
    secret: z.string().optional().openapi({
      description: 'Signing secret — returned only once, when created or rotated. Store it now.',
    }),
    updatedAt: isoDateTime,
  })
  .openapi('WebhookConfig');
export type WebhookConfigDto = z.infer<typeof webhookConfigDto>;

export const putWebhookBody = z
  .object({
    url: z.url().max(500),
    enabled: z.boolean().default(true),
    minSeverity: z.enum(SEVERITIES).default('medium'),
  })
  .strict()
  .openapi('PutWebhookRequest');
export type PutWebhookBody = z.infer<typeof putWebhookBody>;

export const webhookTestDto = z
  .object({
    ok: z.boolean(),
    status: z.number().int().nullable(),
    error: z.string().nullable(),
  })
  .openapi('WebhookTestResult');

export const webhookDeliveryDto = z
  .object({
    id: objectIdSchema,
    event: z.string(),
    status: z.enum(DELIVERY_STATUSES),
    attempts: z.number().int(),
    responseStatus: z.number().int().nullable(),
    lastError: z.string().nullable(),
    createdAt: isoDateTime,
    sentAt: isoDateTime.nullable(),
  })
  .openapi('WebhookDelivery');
