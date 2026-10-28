import { createModuleRouter } from '../../lib/route.js';
import { z } from '../../lib/zod.js';
import {
  analyticsAgentDto,
  analyticsDayDto,
  analyticsQuery,
  analyticsSummaryDto,
} from './analytics.schemas.js';
import { getAgentScorecards, getDaily, getSummary } from './analytics.service.js';
import { REPORT_TYPES, exportReport } from './reports.service.js';

const RANGE_NOTE =
  'Days are calendar days in the organization timezone (default: the last 7 days incl. today, ' +
  'max 92). Finished days come from the nightly rollup; today is computed live (≤ 1 min old). ' +
  'Managers see their teams only.';

export const analyticsRoutes = createModuleRouter({ basePath: '/analytics', tag: 'Analytics' });

analyticsRoutes.route({
  method: 'get',
  path: '/summary',
  summary: 'KPI totals for a date range',
  description: RANGE_NOTE,
  auth: ['admin', 'manager'],
  query: analyticsQuery,
  response: analyticsSummaryDto,
  handler: async ({ actor, query }) => ({ data: await getSummary(actor, query) }),
});

analyticsRoutes.route({
  method: 'get',
  path: '/daily',
  summary: 'KPI trend, one entry per day (empty days included)',
  description: RANGE_NOTE,
  auth: ['admin', 'manager'],
  query: analyticsQuery,
  response: z.array(analyticsDayDto),
  handler: async ({ actor, query }) => ({ data: await getDaily(actor, query) }),
});

analyticsRoutes.route({
  method: 'get',
  path: '/agents',
  summary: 'Per-agent scorecards for a date range (sorted by name)',
  description: RANGE_NOTE,
  auth: ['admin', 'manager'],
  query: analyticsQuery,
  response: z.array(analyticsAgentDto),
  handler: async ({ actor, query }) => ({ data: await getAgentScorecards(actor, query) }),
});

export const reportRoutes = createModuleRouter({ basePath: '/reports', tag: 'Analytics' });

reportRoutes.route({
  method: 'get',
  path: '/:type',
  summary: 'Download a CSV report (visits, anomalies or agent-daily)',
  description:
    `${RANGE_NOTE} Streams \`text/csv\` (UTF-8 with BOM for Excel). Every export is audited ` +
    '(`report.exported`).',
  auth: ['admin', 'manager'],
  params: z.object({ type: z.enum(REPORT_TYPES) }),
  query: analyticsQuery,
  produces: 'text/csv',
  handler: async ({ actor, params, query, res }) => {
    await exportReport(actor, params.type, query, res);
  },
});
