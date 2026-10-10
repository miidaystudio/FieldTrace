/**
 * Typed FieldTrace backend contract (subset used by the UI) + endpoint functions.
 * Source of truth: backend/docs/openapi.json and backend/docs/realtime-and-tracking.md.
 */
import { api, apiAll, apiPage, setSession, type SessionPayload } from './client';

// ------------------------------------------------------------------ enums

export type Role = 'admin' | 'manager' | 'agent';
export type UserStatus = 'active' | 'deactivated';
export type ShiftStatus = 'off_shift' | 'on_shift' | 'on_break';
export type Connectivity = 'online' | 'stale' | 'offline';
export type Motion = 'moving' | 'idle' | 'stopped';
export type TelemetryFlag = 'low_accuracy' | 'mock_location';
export type VehicleType = 'none' | 'bicycle' | 'motorcycle' | 'car' | 'van' | 'truck';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type AssignmentPriority = 'low' | 'normal' | 'high' | 'urgent';
export type VisitStatus = 'pending' | 'in_progress' | 'verified' | 'needs_review' | 'missed' | 'rejected';
export type VisitReviewReason =
  | 'low_accuracy'
  | 'mock_location'
  | 'insufficient_dwell'
  | 'signal_lost'
  | 'checkin_outside_geofence'
  | 'no_gps_presence'
  | 'evidence_required';

export interface LatLng {
  lat: number;
  lng: number;
}

// ------------------------------------------------------------------ DTOs

export interface UserDto {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  staleAfterSec: number;
  offlineAfterSec: number;
  telemetryRetentionDays: number;
  workingHours: { start: string; end: string; days: number[] };
  geofenceDefaults: { radiusM: number; minDwellSec: number };
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  settings: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse extends SessionPayload {
  user: UserDto;
  organization: OrganizationDto;
}

export interface AgentDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: UserStatus;
  mustChangePassword: boolean;
  teamId: string | null;
  employeeCode: string | null;
  phone: string | null;
  vehicle: { type: VehicleType; plate: string | null };
  shiftStatus: ShiftStatus;
  lastLocation: { position: LatLng; accuracyM: number | null; recordedAt: string } | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamDto {
  id: string;
  name: string;
  description: string | null;
  managerIds: string[];
  isArchived: boolean;
}

export type GeofenceDto =
  | { shape: 'circle'; radiusM: number }
  | { shape: 'polygon'; vertices: LatLng[] };

export interface LocationDto {
  id: string;
  name: string;
  address: string | null;
  contact: { name: string | null; phone: string | null; email: string | null };
  position: LatLng;
  geofence: GeofenceDto;
  visitRules: { minDwellSec: number; requireQr: boolean; requirePhoto: boolean };
  tags: string[];
  externalRef: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentDto {
  id: string;
  agentId: string;
  teamId: string | null;
  locationId: string;
  agent: { id: string; name: string } | null;
  location: { id: string; name: string; address: string | null; position: LatLng } | null;
  scheduledDate: string;
  window: { start: string; end: string } | null;
  deadline: string | null;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  title: string | null;
  notes: string | null;
  /** `by` is null when the system made the change (visit verified, deadline passed). */
  statusHistory: { status: AssignmentStatus; at: string; by: string | null; reason: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  at: string;
}

export interface LiveAgentDto {
  agentId: string;
  name: string;
  teamId: string | null;
  employeeCode: string | null;
  vehicle: { type: VehicleType; plate: string | null };
  shiftStatus: ShiftStatus;
  connectivity: Connectivity;
  motion: Motion | null;
  position: LatLng | null;
  accuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  batteryPct: number | null;
  flags: TelemetryFlag[];
  recordedAt: string | null;
  lastSeenAt: string | null;
}

export interface TrackPointDto {
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps: number | null;
  headingDeg: number | null;
  recordedAt: string;
  flags: TelemetryFlag[];
}

export interface TrackDto {
  agentId: string;
  from: string;
  to: string;
  points: TrackPointDto[];
  pointCount: number;
  truncated: boolean;
  nextFrom: string | null;
  distanceM: number;
}

export interface ShiftSessionDto {
  id: string;
  agentId: string;
  isActive: boolean;
  shiftStatus: ShiftStatus;
  startedAt: string;
  endedAt: string | null;
  sampleCount: number;
  lastSampleAt: string | null;
}

export interface TelemetrySampleInput {
  seq: number;
  lat: number;
  lng: number;
  accuracyM: number;
  recordedAt: string;
  speedMps?: number | null;
  headingDeg?: number | null;
  altitudeM?: number | null;
  batteryPct?: number | null;
}

export interface TelemetryResultDto {
  accepted: number;
  duplicates: number;
  rejected: { seq: number; reason: string }[];
  serverTime: string;
}

// Socket.IO payloads (docs/realtime-and-tracking.md §3)
export interface EventEnvelope<T> {
  v: 1;
  id: string;
  type: string;
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
  motion: Motion;
  flags: TelemetryFlag[];
  recordedAt: string;
  receivedAt: string;
}

export interface AgentStatusPayload {
  agentId: string;
  teamId: string | null;
  shiftStatus: ShiftStatus;
  connectivity: Connectivity;
  lastSeenAt: string | null;
}

export interface VisitDto {
  id: string;
  agentId: string;
  agent: { id: string; name: string } | null;
  teamId: string | null;
  locationId: string;
  location: { id: string; name: string; address: string | null; position: LatLng } | null;
  assignmentId: string | null;
  method: 'auto' | 'manual';
  status: VisitStatus;
  isOpen: boolean;
  visitDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationSec: number | null;
  arrival: { windowStart: string; windowEnd: string; delaySec: number; onTime: boolean } | null;
  signals: { sampleCount: number; avgAccuracyM: number | null; maxAccuracyM: number | null; mockLocation: boolean };
  reviewReasons: VisitReviewReason[];
  evidence: {
    type: 'geofence_entry' | 'geofence_exit' | 'manual_checkin' | 'manual_checkout';
    at: string;
    position: LatLng;
    accuracyM: number | null;
    insideGeofence: boolean;
    distanceM: number | null;
  }[];
  review: { by: string; at: string; decision: 'verified' | 'rejected'; note: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceTransitionPayload {
  agentId: string;
  teamId: string | null;
  locationId: string;
  locationName: string;
  type: 'entered' | 'exited';
  at: string;
  position: LatLng;
  accuracyM: number | null;
  dwellSec: number | null;
}

export interface RouteAnalysisDto {
  agentId: string;
  from: string;
  to: string;
  pointCount: number;
  distanceM: number;
  movingTimeSec: number;
  stoppedTimeSec: number;
  stops: {
    start: string;
    end: string;
    durationSec: number;
    position: LatLng;
    locationId: string | null;
    locationName: string | null;
    kind: 'client_site' | 'unplanned';
  }[];
  gaps: { from: string; to: string; durationSec: number }[];
  plan: {
    assignmentId: string;
    locationId: string;
    locationName: string | null;
    plannedOrder: number;
    actualOrder: number | null;
    visitId: string | null;
    visitStatus: VisitStatus | null;
    assignmentStatus: string;
  }[];
  outOfOrder: boolean;
}

// ------------------------------------------------------------------ endpoints

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const session = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setSession(session);
    return session;
  },
  async logout(): Promise<void> {
    try {
      await api('/auth/logout', { method: 'POST', auth: false });
    } finally {
      setSession(null);
    }
  },
  me: () => api<{ user: UserDto; organization: OrganizationDto }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
};

export const organizationApi = {
  get: () => api<OrganizationDto>('/organization'),
  update: (body: Partial<Pick<OrganizationDto, 'name' | 'timezone'>> & {
    settings?: Partial<OrganizationSettings>;
  }) => api<OrganizationDto>('/organization', { method: 'PATCH', body }),
};

export const agentsApi = {
  listAll: () => apiAll<AgentDto>('/agents', { sort: 'name' }),
  me: () => api<AgentDto>('/agents/me'),
  create: (body: {
    name: string;
    email: string;
    temporaryPassword: string;
    teamId?: string | null;
    employeeCode?: string | null;
    phone?: string | null;
    vehicle?: { type: VehicleType; plate: string | null };
  }) => api<AgentDto>('/agents', { method: 'POST', body }),
};

export const teamsApi = {
  listAll: () => apiAll<TeamDto>('/teams'),
};

export const locationsApi = {
  listAll: () => apiAll<LocationDto>('/locations', { sort: 'name' }),
  create: (body: {
    name: string;
    address?: string | null;
    position: LatLng;
    geofence?: GeofenceDto;
    contact?: { name?: string | null };
    tags?: string[];
  }) => api<LocationDto>('/locations', { method: 'POST', body }),
};

export const assignmentsApi = {
  listForDate: (date: string) => apiAll<AssignmentDto>('/assignments', { date, sort: 'scheduledDate' }),
  listRange: (dateFrom: string, dateTo: string) =>
    apiAll<AssignmentDto>('/assignments', { dateFrom, dateTo, sort: '-scheduledDate' }),
  mine: (date?: string) =>
    apiPage<AssignmentDto>('/assignments/mine', { query: { date, limit: 100, sort: 'scheduledDate' } }).then(
      (r) => r.data,
    ),
  create: (body: {
    agentId: string;
    locationId: string;
    scheduledDate: string;
    priority?: AssignmentPriority;
    title?: string | null;
    window?: { start: string; end: string } | null;
  }) => api<AssignmentDto>('/assignments', { method: 'POST', body }),
  setStatus: (id: string, status: 'in_progress' | 'completed' | 'cancelled', reason?: string) =>
    api<AssignmentDto>(`/assignments/${id}/status`, { method: 'POST', body: { status, reason } }),
};

export const auditApi = {
  list: (page: number, limit = 50) =>
    apiPage<AuditLogDto>('/audit-logs', { query: { page, limit } }),
};

export const fleetApi = {
  live: () => api<{ agents: LiveAgentDto[]; asOf: string }>('/fleet/live'),
  /** All points of a window (≤ 24 h), following `nextFrom` pagination. */
  async track(agentId: string, from: string, to: string): Promise<TrackDto> {
    let cursor = from;
    const points: TrackPointDto[] = [];
    let last: TrackDto | null = null;
    for (let page = 0; page < 20; page++) {
      last = await api<TrackDto>(`/agents/${agentId}/track`, {
        query: { from: cursor, to, limit: 5000 },
      });
      points.push(...last.points);
      if (!last.truncated || !last.nextFrom) break;
      cursor = last.nextFrom;
    }
    return { ...(last as TrackDto), from, points, pointCount: points.length, truncated: false };
  },
};

export const shiftsApi = {
  current: () => api<{ session: ShiftSessionDto | null }>('/shifts/current'),
  start: () =>
    api<ShiftSessionDto>('/shifts/start', { method: 'POST', body: { device: { platform: 'web' } } }),
  end: () => api<ShiftSessionDto>('/shifts/end', { method: 'POST' }),
  setBreak: (onBreak: boolean) =>
    api<ShiftSessionDto>('/shifts/break', { method: 'POST', body: { onBreak } }),
};

export const telemetryApi = {
  send: (sessionId: string, samples: TelemetrySampleInput[]) =>
    api<TelemetryResultDto>('/telemetry', { method: 'POST', body: { sessionId, samples } }),
};

export const visitsApi = {
  listForDate: (date: string) => apiAll<VisitDto>('/visits', { date, sort: '-checkInAt' }),
  mine: (date?: string) =>
    apiPage<VisitDto>('/visits/mine', { query: { date, limit: 100 } }).then((r) => r.data),
  checkIn: (body: { assignmentId?: string; locationId?: string; position: LatLng; accuracyM: number }) =>
    api<VisitDto>('/visits/check-in', { method: 'POST', body }),
  checkOut: (id: string, body: { position: LatLng; accuracyM: number }) =>
    api<VisitDto>(`/visits/${id}/check-out`, { method: 'POST', body }),
  review: (id: string, decision: 'verified' | 'rejected', note?: string) =>
    api<VisitDto>(`/visits/${id}/review`, { method: 'POST', body: { decision, note: note || undefined } }),
};

export const routeAnalysisApi = {
  get: (agentId: string, from: string, to: string) =>
    api<RouteAnalysisDto>(`/agents/${agentId}/route-analysis`, { query: { from, to } }),
};
