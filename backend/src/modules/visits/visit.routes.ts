import { pageMeta, skipFor } from '../../lib/pagination.js';
import { createModuleRouter } from '../../lib/route.js';
import { idParams, idString, toObjectId } from '../../shared/schemas.js';
import { resolveTeamScope, teamScopeFilter } from '../teams/team.scope.js';
import { GeofenceEvent } from './geofence-event.model.js';
import { getRouteAnalysis } from './route-analysis.service.js';
import {
  checkInBody,
  checkOutBody,
  geofenceEventDto,
  listGeofenceEventsQuery,
  listVisitsQuery,
  myVisitsQuery,
  reviewVisitBody,
  routeAnalysisDto,
  routeAnalysisQuery,
  visitDto,
} from './visit.schemas.js';
import {
  checkIn,
  checkOut,
  getVisit,
  listMyVisits,
  listVisits,
  reviewVisit,
} from './visit.service.js';

// ---------------------------------------------------------------- visits

export const visitRoutes = createModuleRouter({ basePath: '/visits', tag: 'Visits' });

// Registered before `/:id` so the literal segments are not parsed as ids.
visitRoutes.route({
  method: 'get',
  path: '/mine',
  summary: "The calling agent's visits (driver app)",
  auth: ['agent'],
  query: myVisitsQuery,
  response: visitDto,
  list: true,
  handler: ({ actor, query }) => listMyVisits(actor, query),
});

visitRoutes.route({
  method: 'post',
  path: '/check-in',
  summary: 'Manual check-in at a client location (driver app)',
  description:
    'Send the device position with the check-in. A check-in outside the geofence is accepted but ' +
    'flagged `checkin_outside_geofence` for review. Idempotent while the same visit is open; ' +
    'returns 409 if a visit at another location is still open.',
  auth: ['agent'],
  body: checkInBody,
  response: visitDto,
  errors: [409],
  handler: async ({ actor, body }) => ({ data: await checkIn(actor, body) }),
});

visitRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List visits (proof-of-visit ledger)',
  description:
    'Admins see all; managers see visits of their teams. Filter by day (`date`) or range.',
  auth: ['admin', 'manager'],
  query: listVisitsQuery,
  response: visitDto,
  list: true,
  handler: ({ actor, query }) => listVisits(actor, query),
});

visitRoutes.route({
  method: 'get',
  path: '/:id',
  summary: 'Get a visit with its evidence',
  auth: ['admin', 'manager', 'agent'],
  params: idParams,
  response: visitDto,
  handler: async ({ actor, params }) => ({ data: await getVisit(actor, params.id) }),
});

visitRoutes.route({
  method: 'post',
  path: '/:id/check-out',
  summary: 'Manual check-out of the open visit (driver app)',
  auth: ['agent'],
  params: idParams,
  body: checkOutBody,
  response: visitDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({ data: await checkOut(actor, params.id, body) }),
});

visitRoutes.route({
  method: 'post',
  path: '/:id/review',
  summary: 'Verify or reject a closed visit (audited)',
  description: '`note` is required when rejecting. Verifying completes the linked assignment.',
  auth: ['admin', 'manager'],
  params: idParams,
  body: reviewVisitBody,
  response: visitDto,
  errors: [409],
  handler: async ({ actor, params, body }) => ({ data: await reviewVisit(actor, params.id, body) }),
});

// ---------------------------------------------------------------- geofence events

export const geofenceEventRoutes = createModuleRouter({
  basePath: '/geofence-events',
  tag: 'Visits',
});

geofenceEventRoutes.route({
  method: 'get',
  path: '/',
  summary: 'Geofence entry/exit events (newest first)',
  auth: ['admin', 'manager'],
  query: listGeofenceEventsQuery,
  response: geofenceEventDto,
  list: true,
  handler: async ({ actor, query }) => {
    const scope = await resolveTeamScope(actor);
    const filter: Record<string, unknown> = {
      orgId: toObjectId(actor.orgId),
      ...teamScopeFilter(scope),
    };
    if (query.agentId) filter.agentId = toObjectId(query.agentId);
    if (query.locationId) filter.locationId = toObjectId(query.locationId);
    if (query.from || query.to) {
      filter.at = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }
    const [docs, total] = await Promise.all([
      GeofenceEvent.find(filter)
        .sort({ at: -1, _id: -1 })
        .skip(skipFor(query.page, query.limit))
        .limit(query.limit)
        .lean(),
      GeofenceEvent.countDocuments(filter),
    ]);
    return {
      data: docs.map((doc) => ({
        id: idString(doc._id),
        agentId: idString(doc.agentId),
        teamId: doc.teamId ? idString(doc.teamId) : null,
        locationId: idString(doc.locationId),
        type: doc.type,
        at: doc.at.toISOString(),
        position: { lat: doc.lat, lng: doc.lng },
        accuracyM: doc.accuracyM,
        dwellSec: doc.dwellSec,
      })),
      meta: pageMeta(query.page, query.limit, total),
    };
  },
});

// ---------------------------------------------------------------- route analysis

export const routeAnalysisRoutes = createModuleRouter({ basePath: '/agents', tag: 'Live Fleet' });

routeAnalysisRoutes.route({
  method: 'get',
  path: '/:id/route-analysis',
  summary: 'Stops, GPS gaps and planned-vs-actual sequence for a time window (≤ 24 h)',
  description:
    'Defaults to the last 12 hours. Stops are stays ≥ 3 min within 50 m; `unplanned` stops are not ' +
    'at any client location (a deviation signal, not proof of misconduct). Agents may read their own.',
  auth: ['admin', 'manager', 'agent'],
  params: idParams,
  query: routeAnalysisQuery,
  response: routeAnalysisDto,
  handler: async ({ actor, params, query }) => ({
    data: await getRouteAnalysis(actor, params.id, query),
  }),
});
