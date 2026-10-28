import type {
  ConnectivityStatus,
  GeofenceEventType,
  MotionStatus,
  ShiftStatus,
  TelemetryFlag,
} from '../shared/enums.js';
import type { AnomalyDto } from '../modules/anomalies/anomaly.schemas.js';
import type { NotificationDto } from '../modules/notifications/notification.schemas.js';
import type { RoutePlanDto } from '../modules/routing/route.schemas.js';
import type { AssignmentDto } from '../modules/assignments/assignment.schemas.js';
import type { VisitDto } from '../modules/visits/visit.schemas.js';
import type { LatLng } from '../shared/schemas.js';

/**
 * Socket.IO event contract (server → client). Documented in docs/socket-events.md.
 * Every event is wrapped in an {@link EventEnvelope}; `id` lets clients drop duplicates after
 * reconnects, `v` versions the payload shape.
 */
export interface EventEnvelope<T> {
  v: 1;
  id: string;
  type: string;
  /** Server emit time (ISO-8601 UTC). */
  ts: string;
  data: T;
}

export interface LocationUpdatePayload {
  agentId: string;
  teamId: string | null;
  position: LatLng;
  accuracyM: number;
  speedMps: number | null;
  headingDeg: number | null;
  batteryPct: number | null;
  motion: MotionStatus;
  flags: TelemetryFlag[];
  /** Device time of the fix. */
  recordedAt: string;
  /** Server receive time. */
  receivedAt: string;
}

export interface AgentStatusPayload {
  agentId: string;
  teamId: string | null;
  shiftStatus: ShiftStatus;
  connectivity: ConnectivityStatus;
  lastSeenAt: string | null;
}

export interface GeofenceTransitionPayload {
  agentId: string;
  teamId: string | null;
  locationId: string;
  locationName: string;
  type: GeofenceEventType;
  /** Device time of the fix that confirmed the transition. */
  at: string;
  position: LatLng;
  accuracyM: number | null;
  /** Exits only: time spent inside. */
  dwellSec: number | null;
}

export type VisitUpdatedPayload = VisitDto;
export type AssignmentUpdatedPayload = AssignmentDto;
/** Anomalies go to admins and the agent's team managers only — never to the agent. */
export type AnomalyPayload = AnomalyDto;

export interface SessionReadyPayload {
  userId: string;
  role: string;
  /** Rooms the server subscribed this socket to (informational). */
  scope: 'organization' | 'teams' | 'self';
  teamIds: string[];
  tokenExpiresAt: string;
}

export interface ServerToClientEvents {
  'location:update': (event: EventEnvelope<LocationUpdatePayload>) => void;
  'agent:status': (event: EventEnvelope<AgentStatusPayload>) => void;
  'session:ready': (event: EventEnvelope<SessionReadyPayload>) => void;
  'geofence:entered': (event: EventEnvelope<GeofenceTransitionPayload>) => void;
  'geofence:exited': (event: EventEnvelope<GeofenceTransitionPayload>) => void;
  'visit:updated': (event: EventEnvelope<VisitUpdatedPayload>) => void;
  'assignment:updated': (event: EventEnvelope<AssignmentUpdatedPayload>) => void;
  'anomaly:created': (event: EventEnvelope<AnomalyPayload>) => void;
  'anomaly:updated': (event: EventEnvelope<AnomalyPayload>) => void;
  /** A saved route plan (staff of the team + the agent). */
  'route:updated': (event: EventEnvelope<RoutePlanDto>) => void;
  /** Sent only to the recipient's personal room. */
  'notification:created': (event: EventEnvelope<NotificationDto>) => void;
  /** Sent just before the server disconnects a socket whose access token expired. */
  'auth:expired': (event: EventEnvelope<{ reason: 'token_expired' }>) => void;
}

/** Clients do not send events in Phase 2 (telemetry goes over HTTP). */
export type ClientToServerEvents = Record<string, never>;

export const SOCKET_EVENTS = {
  LOCATION_UPDATE: 'location:update',
  AGENT_STATUS: 'agent:status',
  SESSION_READY: 'session:ready',
  AUTH_EXPIRED: 'auth:expired',
  GEOFENCE_ENTERED: 'geofence:entered',
  GEOFENCE_EXITED: 'geofence:exited',
  VISIT_UPDATED: 'visit:updated',
  ASSIGNMENT_UPDATED: 'assignment:updated',
  ANOMALY_CREATED: 'anomaly:created',
  ANOMALY_UPDATED: 'anomaly:updated',
  NOTIFICATION_CREATED: 'notification:created',
  ROUTE_UPDATED: 'route:updated',
} as const;

export const rooms = {
  /** Admins: every agent of the organization. */
  organization: (orgId: string) => `org:${orgId}:all`,
  /** Managers: agents of one team they manage. */
  team: (orgId: string, teamId: string) => `org:${orgId}:team:${teamId}`,
  /** The agent's own channel (driver app). */
  agent: (orgId: string, agentId: string) => `org:${orgId}:agent:${agentId}`,
  /** One user's personal channel (notifications), joined by every role. */
  user: (orgId: string, userId: string) => `org:${orgId}:user:${userId}`,
};
