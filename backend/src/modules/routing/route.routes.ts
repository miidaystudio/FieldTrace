import { createModuleRouter } from '../../lib/route.js';
import { z } from '../../lib/zod.js';
import { listRoutesQuery, myRouteQuery, planRouteBody, routePlanDto } from './route.schemas.js';
import { getMyRoute, listRoutes, previewRoute, saveRoute } from './route.service.js';

const OPTIMIZE_NOTE =
  'Sequences up to 20 open assignments of one agent for a day: time windows (late arrivals are ' +
  'heavily penalised, weighted by priority), service time per stop, optional return to start. ' +
  'Travel times come from OpenRouteService when `ORS_API_KEY` is set, otherwise from straight-line ' +
  'estimates (`provider: builtin`, see `warnings`). `baseline` is the current order for comparison.';

export const routeRoutes = createModuleRouter({ basePath: '/routes', tag: 'Routes' });

routeRoutes.route({
  method: 'post',
  path: '/optimize',
  summary: 'Preview an optimized stop order with ETAs (not saved)',
  description: OPTIMIZE_NOTE,
  auth: ['admin', 'manager'],
  body: planRouteBody,
  response: routePlanDto,
  handler: async ({ actor, body }) => ({ data: await previewRoute(actor, body) }),
});

routeRoutes.route({
  method: 'post',
  path: '/',
  summary: "Optimize and save as the agent's route for the day (audited)",
  description: `${OPTIMIZE_NOTE} Supersedes the previous plan of that agent and day, links the assignments (\`routeId\`) and pushes \`route:updated\`. Route analysis then uses this order as the plan.`,
  auth: ['admin', 'manager'],
  body: planRouteBody,
  status: 201,
  response: routePlanDto,
  handler: async ({ actor, body }) => ({ data: await saveRoute(actor, body) }),
});

routeRoutes.route({
  method: 'get',
  path: '/',
  summary: 'Active route plans of a day (default today)',
  auth: ['admin', 'manager'],
  query: listRoutesQuery,
  response: z.array(routePlanDto),
  handler: async ({ actor, query }) => ({ data: await listRoutes(actor, query) }),
});

routeRoutes.route({
  method: 'get',
  path: '/mine',
  summary: "The calling agent's planned route (driver app)",
  auth: ['agent'],
  query: myRouteQuery,
  response: routePlanDto,
  handler: async ({ actor, query }) => ({ data: await getMyRoute(actor, query.date) }),
});
