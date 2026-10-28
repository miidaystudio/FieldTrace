import { createModuleRouter } from '../../lib/route.js';
import { idParams } from '../../shared/schemas.js';
import {
  anomalyDto,
  anomalyStatsDto,
  listAnomaliesQuery,
  updateAnomalyStatusBody,
} from './anomaly.schemas.js';
import { anomalyStats, getAnomaly, listAnomalies, updateAnomalyStatus } from './anomaly.service.js';

export const anomalyRoutes = createModuleRouter({ basePath: '/anomalies', tag: 'Anomalies' });

anomalyRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List anomalies (newest activity first)',
  description:
    'Admins see all; managers see anomalies of their teams. Agents never see anomalies. ' +
    'Each item explains the rule that fired and the numbers behind it.',
  auth: ['admin', 'manager'],
  query: listAnomaliesQuery,
  response: anomalyDto,
  list: true,
  handler: ({ actor, query }) => listAnomalies(actor, query),
});

// Registered before `/:id` so `stats` is not parsed as an id.
anomalyRoutes.route({
  method: 'get',
  path: '/stats',
  summary: 'Anomaly counts (active by type/severity, all by status)',
  auth: ['admin', 'manager'],
  response: anomalyStatsDto,
  handler: async ({ actor }) => ({ data: await anomalyStats(actor) }),
});

anomalyRoutes.route({
  method: 'get',
  path: '/:id',
  summary: 'Get an anomaly with its evidence',
  auth: ['admin', 'manager'],
  params: idParams,
  response: anomalyDto,
  handler: async ({ actor, params }) => ({ data: await getAnomaly(actor, params.id) }),
});

anomalyRoutes.route({
  method: 'post',
  path: '/:id/status',
  summary: 'Acknowledge, resolve or dismiss an anomaly (audited)',
  description:
    '`open → acknowledged`; `open|acknowledged → resolved` (note required) or `dismissed` ' +
    '(false positive). Resolved/dismissed are final; a repeat of the signal opens a new anomaly.',
  auth: ['admin', 'manager'],
  params: idParams,
  body: updateAnomalyStatusBody,
  response: anomalyDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({
    data: await updateAnomalyStatus(actor, params.id, body),
  }),
});
