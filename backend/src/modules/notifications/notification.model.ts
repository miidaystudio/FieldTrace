import { Schema, model, type Types } from 'mongoose';
import { tenantScopedPlugin } from '../../lib/tenancy.js';
import { SEVERITIES, type Severity } from '../../shared/enums.js';

export const NOTIFICATION_KINDS = ['anomaly', 'assignment_overdue', 'test'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const DELIVERY_STATUSES = ['pending', 'sent', 'logged', 'skipped', 'failed'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Retry state of one outbound delivery (email to a user, or a webhook POST). */
export interface Delivery {
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  sentAt: Date | null;
}

const deliverySchema = new Schema<Delivery>(
  {
    status: { type: String, enum: DELIVERY_STATUSES, required: true },
    attempts: { type: Number, required: true, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 500 },
    sentAt: { type: Date, default: null },
  },
  { _id: false },
);

/**
 * One message for one user (in-app inbox), with its optional email delivery. Created by
 * `notify()`; emails are sent by the dispatcher with retries (outbox pattern).
 */
export interface NotificationDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  userId: Types.ObjectId;
  kind: NotificationKind;
  severity: Severity;
  title: string;
  body: string;
  /** Dashboard path to open, e.g. `/dashboard/anomalies`. */
  link: string | null;
  entityType: string | null;
  entityId: Types.ObjectId | null;
  readAt: Date | null;
  email: Delivery;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    severity: { type: String, enum: SEVERITIES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 2000 },
    link: { type: String, default: null, maxlength: 300 },
    entityType: { type: String, default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    readAt: { type: Date, default: null },
    email: { type: deliverySchema, required: true },
  },
  { timestamps: true },
);

notificationSchema.index({ orgId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ orgId: 1, userId: 1, readAt: 1 });
notificationSchema.index({ 'email.status': 1, 'email.nextAttemptAt': 1 });
notificationSchema.plugin(tenantScopedPlugin);

export const Notification = model<NotificationDoc>('Notification', notificationSchema);

/** Organization webhook endpoint: every notification event is POSTed here (signed). */
export interface WebhookConfigDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  url: string;
  enabled: boolean;
  /** HMAC-SHA256 signing secret, shown to the admin only when created or rotated. */
  secret: string;
  /** Minimum severity forwarded. */
  minSeverity: Severity;
  createdAt: Date;
  updatedAt: Date;
}

const webhookConfigSchema = new Schema<WebhookConfigDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    url: { type: String, required: true, maxlength: 500 },
    enabled: { type: Boolean, required: true, default: true },
    secret: { type: String, required: true },
    minSeverity: { type: String, enum: SEVERITIES, required: true, default: 'medium' },
  },
  { timestamps: true },
);
webhookConfigSchema.index({ orgId: 1 }, { unique: true });
webhookConfigSchema.plugin(tenantScopedPlugin);

export const WebhookConfig = model<WebhookConfigDoc>('WebhookConfig', webhookConfigSchema);

/** One webhook POST (with retries). */
export interface WebhookDeliveryDoc {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  event: string;
  payload: Record<string, unknown>;
  delivery: Delivery;
  responseStatus: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const webhookDeliverySchema = new Schema<WebhookDeliveryDoc>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    delivery: { type: deliverySchema, required: true },
    responseStatus: { type: Number, default: null },
  },
  { timestamps: true, minimize: false },
);
webhookDeliverySchema.index({ 'delivery.status': 1, 'delivery.nextAttemptAt': 1 });
webhookDeliverySchema.index({ orgId: 1, createdAt: -1 });
// Delivery log is operational data: kept 30 days.
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86_400 });
webhookDeliverySchema.plugin(tenantScopedPlugin);

export const WebhookDelivery = model<WebhookDeliveryDoc>('WebhookDelivery', webhookDeliverySchema);
