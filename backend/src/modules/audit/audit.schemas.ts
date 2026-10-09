import { paginationQuery } from '../../lib/pagination.js';
import { z } from '../../lib/zod.js';
import { ROLES } from '../../shared/enums.js';
import { isoDateTime, objectIdSchema } from '../../shared/schemas.js';

export const auditLogDto = z
  .object({
    id: objectIdSchema,
    actorId: objectIdSchema.nullable(),
    actorRole: z.enum(ROLES).nullable(),
    action: z.string().openapi({ example: 'user.role_changed' }),
    entityType: z.string().openapi({ example: 'user' }),
    entityId: objectIdSchema,
    changes: z
      .record(z.string(), z.object({ from: z.unknown(), to: z.unknown() }))
      .nullable()
      .openapi({ example: { role: { from: 'manager', to: 'admin' } } }),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    requestId: z.string().nullable(),
    at: isoDateTime,
  })
  .openapi('AuditLog');
export type AuditLogDto = z.infer<typeof auditLogDto>;

export const listAuditLogsQuery = paginationQuery.extend({
  entityType: z.string().max(40).optional(),
  entityId: objectIdSchema.optional(),
  actorId: objectIdSchema.optional(),
  /** Prefix match, e.g. `user.` or `assignment.status_changed`. */
  action: z.string().max(80).optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuery>;
