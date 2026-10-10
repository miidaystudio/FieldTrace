import { createModuleRouter } from '../../lib/route.js';
import { idParams } from '../../shared/schemas.js';
import {
  createLocationBody,
  listLocationsQuery,
  locationDto,
  updateLocationBody,
} from './location.schemas.js';
import {
  createLocation,
  getLocation,
  listLocations,
  setLocationArchived,
  updateLocation,
} from './location.service.js';

export const locationRoutes = createModuleRouter({
  basePath: '/locations',
  tag: 'Locations & Geofences',
});

locationRoutes.route({
  method: 'get',
  path: '/',
  summary: 'List client locations',
  description: 'Use `nearLat`, `nearLng` and `withinM` together for a radius search.',
  auth: ['admin', 'manager'],
  query: listLocationsQuery,
  response: locationDto,
  list: true,
  handler: ({ actor, query }) => listLocations(actor, query),
});

locationRoutes.route({
  method: 'post',
  path: '/',
  summary: 'Create a client location with its geofence',
  description:
    'Circle radius must be 10–5000 m. Polygon vertices (3–100) must not self-intersect and must ' +
    'contain `position`.',
  auth: ['admin', 'manager'],
  body: createLocationBody,
  status: 201,
  response: locationDto,
  handler: async ({ actor, body }) => ({ data: await createLocation(actor, body) }),
});

locationRoutes.route({
  method: 'get',
  path: '/:id',
  summary: 'Get a client location',
  auth: ['admin', 'manager'],
  params: idParams,
  response: locationDto,
  handler: async ({ actor, params }) => ({ data: await getLocation(actor, params.id) }),
});

locationRoutes.route({
  method: 'patch',
  path: '/:id',
  summary: 'Update a client location or its geofence (audited)',
  auth: ['admin', 'manager'],
  params: idParams,
  body: updateLocationBody,
  response: locationDto,
  handler: async ({ actor, params, body }) => ({
    data: await updateLocation(actor, params.id, body),
  }),
});

locationRoutes.route({
  method: 'post',
  path: '/:id/archive',
  summary: 'Archive a location (hidden from lists; cannot receive new assignments)',
  auth: ['admin', 'manager'],
  params: idParams,
  response: locationDto,
  handler: async ({ actor, params }) => ({
    data: await setLocationArchived(actor, params.id, true),
  }),
});

locationRoutes.route({
  method: 'post',
  path: '/:id/unarchive',
  summary: 'Restore an archived location',
  auth: ['admin', 'manager'],
  params: idParams,
  response: locationDto,
  handler: async ({ actor, params }) => ({
    data: await setLocationArchived(actor, params.id, false),
  }),
});
