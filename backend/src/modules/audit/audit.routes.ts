import { createModuleRouter } from '../../lib/route.js';
import { auditLogDto, listAuditLogsQuery } from './audit.schemas.js';
import { listAuditLogs } from './audit.service.js';

export const auditRoutes = createModuleRouter({ basePath: '/audit-logs', tag: 'Audit Logs' });

auditRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List audit log entries (newest first)',
  auth: ['admin'],
  query: listAuditLogsQuery,
  response: auditLogDto,
  list: true,
  handler: ({ actor, query }) => listAuditLogs(actor, query),
});
