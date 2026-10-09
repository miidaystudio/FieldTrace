import type { Types } from 'mongoose';
import { logger } from '../../lib/logger.js';
import { escapeRegex, pageMeta, skipFor } from '../../lib/pagination.js';
import { idString, toObjectId } from '../../shared/schemas.js';
import type { Actor } from '../../shared/types.js';
import { AuditLog, type AuditLogDoc, type FieldChanges } from './audit.model.js';
import type { AuditLogDto, ListAuditLogsQuery } from './audit.schemas.js';

/** Converts ObjectIds/Dates/nested docs into plain JSON values for storage and comparison. */
const plain = (value: unknown): unknown =>
  value === undefined ? null : (JSON.parse(JSON.stringify(value)) as unknown);

/** Field-level diff between two snapshots, limited to the given fields. */
export function diffFields(before: object, after: object, fields: readonly string[]): FieldChanges {
  const changes: FieldChanges = {};
  for (const field of fields) {
    const from = plain((before as Record<string, unknown>)[field]);
    const to = plain((after as Record<string, unknown>)[field]);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  }
  return changes;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: Types.ObjectId | string;
  changes?: FieldChanges | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Writes an audit record. Audit failures are logged but never fail the user's request; the
 * primary write has already succeeded at this point.
 */
export async function recordAudit(actor: Actor, entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      orgId: actor.orgId,
      actorId: actor.userId,
      actorRole: actor.role,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes && Object.keys(entry.changes).length > 0 ? entry.changes : null,
      metadata: entry.metadata ?? null,
      requestId: actor.requestId,
      ip: actor.ip ?? null,
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
  }
}

/** Audit for flows without an Actor yet (e.g. registration). */
export async function recordSystemAudit(
  orgId: Types.ObjectId,
  actorId: Types.ObjectId | null,
  entry: AuditEntry & { requestId?: string; ip?: string | undefined },
): Promise<void> {
  try {
    await AuditLog.create({
      orgId,
      actorId,
      actorRole: null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes ?? null,
      metadata: entry.metadata ?? null,
      requestId: entry.requestId ?? null,
      ip: entry.ip ?? null,
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, 'Failed to write audit log');
  }
}

export function toAuditLogDto(doc: AuditLogDoc): AuditLogDto {
  return {
    id: idString(doc._id),
    actorId: doc.actorId ? idString(doc.actorId) : null,
    actorRole: doc.actorRole,
    action: doc.action,
    entityType: doc.entityType,
    entityId: idString(doc.entityId),
    changes: doc.changes,
    metadata: doc.metadata,
    requestId: doc.requestId,
    at: doc.at.toISOString(),
  };
}

export async function listAuditLogs(actor: Actor, query: ListAuditLogsQuery) {
  const filter: Record<string, unknown> = { orgId: toObjectId(actor.orgId) };
  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = toObjectId(query.entityId);
  if (query.actorId) filter.actorId = toObjectId(query.actorId);
  if (query.action) filter.action = new RegExp(`^${escapeRegex(query.action)}`);
  if (query.from || query.to) {
    filter.at = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }

  const [docs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1, _id: -1 })
      .skip(skipFor(query.page, query.limit))
      .limit(query.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { data: docs.map(toAuditLogDto), meta: pageMeta(query.page, query.limit, total) };
}
