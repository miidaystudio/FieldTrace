import { createModuleRouter } from '../../lib/route.js';
import { idParams } from '../../shared/schemas.js';
import { getAgentTrack, getFleetLive } from './fleet.service.js';
import { endShift, getCurrentShift, setBreak, startShift } from './shift.service.js';
import { ingestTelemetry } from './telemetry.service.js';
import {
  breakBody,
  currentShiftDto,
  fleetLiveDto,
  fleetLiveQuery,
  shiftSessionDto,
  startShiftBody,
  telemetryBatchBody,
  telemetryResultDto,
  trackDto,
  trackQuery,
} from './tracking.schemas.js';

// ---------------------------------------------------------------- shifts (driver app)

export const shiftRoutes = createModuleRouter({ basePath: '/shifts', tag: 'Shifts' });

shiftRoutes.route({
  method: 'get',
  path: '/current',
  summary: "The calling agent's active shift, or null",
  description: 'Call on app start to resume tracking with the existing `session.id`.',
  auth: ['agent'],
  response: currentShiftDto,
  handler: async ({ actor }) => ({ data: await getCurrentShift(actor) }),
});

shiftRoutes.route({
  method: 'post',
  path: '/start',
  summary: 'Start a shift (opens a tracking session)',
  description:
    'Idempotent: if a shift is already active it is returned unchanged. Use the returned `id` as ' +
    '`sessionId` for telemetry. Broadcasts `agent:status`.',
  auth: ['agent'],
  body: startShiftBody,
  response: shiftSessionDto,
  handler: async ({ actor, body, req }) => ({
    data: await startShift(actor, body, req.get('user-agent')),
  }),
});

shiftRoutes.route({
  method: 'post',
  path: '/break',
  summary: 'Start or end a break during the active shift',
  auth: ['agent'],
  body: breakBody,
  response: shiftSessionDto,
  errors: [409],
  handler: async ({ actor, body }) => ({ data: await setBreak(actor, body.onBreak) }),
});

shiftRoutes.route({
  method: 'post',
  path: '/end',
  summary: 'End the active shift (telemetry for this session is no longer accepted)',
  auth: ['agent'],
  response: shiftSessionDto,
  errors: [409],
  handler: async ({ actor }) => ({ data: await endShift(actor) }),
});

// ---------------------------------------------------------------- telemetry (driver app)

export const telemetryRoutes = createModuleRouter({ basePath: '/telemetry', tag: 'Telemetry' });

telemetryRoutes.route({
  method: 'post',
  path: '/',
  summary: 'Upload a batch of GPS samples for the active shift',
  description:
    'Send samples every 5–10 s (or queue them while offline and upload later, oldest first). ' +
    'Idempotent per `(sessionId, seq)`: re-sending a batch after a timeout is safe. Samples are ' +
    'rejected when timestamped in the future (> 2 min skew), older than 24 h, or before the ' +
    'shift started. `409 SHIFT_NOT_ACTIVE` means the session ended — start a new shift.',
  auth: ['agent'],
  body: telemetryBatchBody,
  response: telemetryResultDto,
  errors: [409, 413],
  handler: async ({ actor, body }) => ({ data: await ingestTelemetry(actor, body) }),
});

// ---------------------------------------------------------------- fleet (dashboard)

export const fleetRoutes = createModuleRouter({ basePath: '/fleet', tag: 'Live Fleet' });

fleetRoutes.route({
  method: 'get',
  path: '/live',
  summary: 'Live map snapshot: latest position and status of every agent in scope',
  description:
    'Load once when the map opens and after every socket reconnect; apply `location:update` and ' +
    '`agent:status` events in between. Deactivated agents are excluded.',
  auth: ['admin', 'manager'],
  query: fleetLiveQuery,
  response: fleetLiveDto,
  handler: async ({ actor, query }) => ({ data: await getFleetLive(actor, query) }),
});

// ---------------------------------------------------------------- history

export const trackRoutes = createModuleRouter({ basePath: '/agents', tag: 'Live Fleet' });

trackRoutes.route({
  method: 'get',
  path: '/:id/track',
  summary: 'Raw GPS track of an agent for a time window (≤ 24 h, oldest first)',
  description:
    'Defaults to the last 2 hours. If `truncated` is true, request the next page with ' +
    '`from=nextFrom`. Agents may read only their own track.',
  auth: ['admin', 'manager', 'agent'],
  params: idParams,
  query: trackQuery,
  response: trackDto,
  handler: async ({ actor, params, query }) => ({
    data: await getAgentTrack(actor, params.id, query),
  }),
});
