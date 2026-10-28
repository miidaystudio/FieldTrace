/**
 * Typed FieldTrace backend contract (subset used by the UI) + endpoint functions.
 * Source of truth: backend/docs/openapi.json and backend/docs/realtime-and-tracking.md.
 */
import { api, apiAll, apiDownload, apiPage, setSession, type SessionPayload } from './client';

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
  anomalyRules: AnomalyRules;
}

/** Thresholds of the explainable anomaly rules (Phase 4). */
export interface AnomalyRules {
  impossibleSpeed: { enabled: boolean; maxSpeedKmh: number };
  gpsJump: { enabled: boolean; minDistanceM: number; maxIntervalSec: number };
  mockLocation: { enabled: boolean };
  signalGap: { enabled: boolean; minGapMin: number };
  longUnplannedStop: { enabled: boolean; minStopMin: number };
  visitIssues: { enabled: boolean };
  offHours: { enabled: boolean };
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
    settings?: Partial<Omit<OrganizationSettings, 'anomalyRules'>> & {
      anomalyRules?: { [K in keyof AnomalyRules]?: Partial<AnomalyRules[K]> };
    };
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

// ------------------------------------------------------------------ anomalies (Phase 4)

export type AnomalyType =
  | 'impossible_speed'
  | 'gps_jump'
  | 'mock_location'
  | 'signal_gap'
  | 'long_unplanned_stop'
  | 'visit_issue'
  | 'off_hours_activity';
export type AnomalyStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
export type Severity = 'low' | 'medium' | 'high';

export interface AnomalyDto {
  id: string;
  agentId: string;
  agent: { id: string; name: string } | null;
  teamId: string | null;
  sessionId: string | null;
  type: AnomalyType;
  severity: Severity;
  status: AnomalyStatus;
  title: string;
  explanation: string;
  metrics: Record<string, string | number | boolean | null>;
  position: LatLng | null;
  locationId: string | null;
  visitId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  acknowledged: { by: { id: string; name: string }; at: string } | null;
  resolution: {
    by: { id: string; name: string };
    at: string;
    status: 'resolved' | 'dismissed';
    note: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnomalyStatsDto {
  active: number;
  byStatus: Record<AnomalyStatus, number>;
  activeByType: Record<AnomalyType, number>;
  activeBySeverity: Record<Severity, number>;
}

export const anomaliesApi = {
  /** Most recent anomalies (all statuses), newest activity first. */
  recent: (limit = 100) =>
    apiPage<AnomalyDto>('/anomalies', { query: { limit, sort: '-lastSeenAt' } }).then((r) => r.data),
  stats: () => api<AnomalyStatsDto>('/anomalies/stats'),
  setStatus: (id: string, status: 'acknowledged' | 'resolved' | 'dismissed', note?: string) =>
    api<AnomalyDto>(`/anomalies/${id}/status`, {
      method: 'POST',
      body: { status, note: note?.trim() || undefined },
    }),
};

// ------------------------------------------------------------------ analytics & reports (Phase 4)

export interface AnalyticsRange {
  from?: string;
  to?: string;
  teamId?: string;
}

export interface VisitCounts {
  total: number;
  verified: number;
  needsReview: number;
  rejected: number;
  missed: number;
  inProgress: number;
}

export interface AnalyticsSummaryDto {
  from: string;
  to: string;
  teamId: string | null;
  agentsActive: number;
  distanceKm: number;
  shiftHours: number;
  visits: VisitCounts;
  verificationRate: number | null;
  onTimeRate: number | null;
  avgDwellMin: number | null;
  assignments: { total: number; completed: number; completionRate: number | null };
  anomalies: { total: number; high: number; byType: Record<AnomalyType, number> };
  generatedAt: string;
}

export interface AnalyticsDayDto {
  day: string;
  agentsActive: number;
  distanceKm: number;
  shiftHours: number;
  visits: VisitCounts;
  verificationRate: number | null;
  onTimeRate: number | null;
  assignmentsTotal: number;
  assignmentsCompleted: number;
  anomalies: number;
}

export interface AnalyticsAgentDto {
  agentId: string;
  name: string;
  teamId: string | null;
  daysActive: number;
  distanceKm: number;
  shiftHours: number;
  visits: VisitCounts;
  verificationRate: number | null;
  onTimeRate: number | null;
  assignmentsTotal: number;
  assignmentsCompleted: number;
  anomalies: number;
  highAnomalies: number;
}

export type ReportType = 'visits' | 'anomalies' | 'agent-daily';

const rangeQuery = (range: AnalyticsRange) => ({
  from: range.from,
  to: range.to,
  teamId: range.teamId,
});

export const analyticsApi = {
  summary: (range: AnalyticsRange) =>
    api<AnalyticsSummaryDto>('/analytics/summary', { query: rangeQuery(range) }),
  daily: (range: AnalyticsRange) =>
    api<AnalyticsDayDto[]>('/analytics/daily', { query: rangeQuery(range) }),
  agents: (range: AnalyticsRange) =>
    api<AnalyticsAgentDto[]>('/analytics/agents', { query: rangeQuery(range) }),
  /** Downloads a CSV report through the authenticated client and saves it. */
  downloadReport: async (type: ReportType, range: AnalyticsRange) => {
    const { blob, filename } = await apiDownload(`/reports/${type}`, rangeQuery(range));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename ?? `fieldtrace-${type}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// ------------------------------------------------------------------ notifications (Phase 5)

export type NotificationKind = 'anomaly' | 'assignment_overdue' | 'test';
export type DeliveryStatus = 'pending' | 'sent' | 'logged' | 'skipped' | 'failed';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  severity: Severity;
  title: string;
  body: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  emailStatus: DeliveryStatus;
  createdAt: string;
}

export interface NotificationPrefs {
  events: { anomaly: boolean; assignment_overdue: boolean };
  email: { enabled: boolean; minSeverity: Severity };
}

export interface WebhookConfigDto {
  url: string;
  enabled: boolean;
  minSeverity: Severity;
  secretHint: string;
  /** Only right after creation / rotation. */
  secret?: string;
  updatedAt: string;
}

export interface WebhookDeliveryDto {
  id: string;
  event: string;
  status: DeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export const notificationsApi = {
  recent: (limit = 30) =>
    apiPage<NotificationDto>('/notifications', { query: { limit } }).then((r) => r.data),
  unreadCount: () => api<{ unread: number }>('/notifications/unread-count').then((r) => r.unread),
  markRead: (id: string) => api<NotificationDto>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => api<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
  prefs: () => api<NotificationPrefs>('/notifications/preferences'),
  updatePrefs: (body: { events?: Partial<NotificationPrefs['events']>; email?: Partial<NotificationPrefs['email']> }) =>
    api<NotificationPrefs>('/notifications/preferences', { method: 'PATCH', body }),
  webhook: () => api<WebhookConfigDto>('/notifications/webhook'),
  putWebhook: (body: { url: string; enabled: boolean; minSeverity: Severity }) =>
    api<WebhookConfigDto>('/notifications/webhook', { method: 'PUT', body }),
  deleteWebhook: () => api<void>('/notifications/webhook', { method: 'DELETE' }),
  rotateSecret: () => api<WebhookConfigDto>('/notifications/webhook/rotate-secret', { method: 'POST' }),
  testWebhook: () =>
    api<{ ok: boolean; status: number | null; error: string | null }>('/notifications/webhook/test', {
      method: 'POST',
    }),
  deliveries: () => api<WebhookDeliveryDto[]>('/notifications/webhook/deliveries'),
};

// ------------------------------------------------------------------ route optimization (Phase 5)

export interface PlannedStopDto {
  sequence: number;
  assignmentId: string;
  locationId: string;
  locationName: string | null;
  title: string | null;
  position: LatLng;
  priority: AssignmentPriority;
  window: { start: string; end: string } | null;
  serviceSec: number;
  eta: string;
  departure: string;
  waitSec: number;
  lateSec: number;
  legDistanceM: number;
  legDurationSec: number;
}

export interface RouteTotals {
  distanceM: number;
  durationSec: number;
  travelSec: number;
  waitSec: number;
  lateSec: number;
  lateStops: number;
}

export interface RoutePlanDto {
  id: string | null;
  agentId: string;
  teamId: string | null;
  date: string;
  status: 'active' | 'superseded' | null;
  provider: 'openrouteservice' | 'builtin';
  fallbackReason: string | null;
  start: { position: LatLng; source: 'current' | 'last_known' | 'custom' | 'first_stop' };
  departAt: string;
  returnToStart: boolean;
  stops: PlannedStopDto[];
  totals: RouteTotals;
  baseline: RouteTotals | null;
  geometry: LatLng[];
  warnings: string[];
  createdAt: string | null;
}

export interface PlanRouteRequest {
  agentId: string;
  date?: string;
  assignmentIds?: string[];
  start?: { type: 'current' } | { type: 'first_stop' } | { type: 'position'; position: LatLng };
  departAt?: string;
  serviceMin?: number;
  returnToStart?: boolean;
}

export const routesApi = {
  optimize: (body: PlanRouteRequest) => api<RoutePlanDto>('/routes/optimize', { method: 'POST', body }),
  save: (body: PlanRouteRequest) => api<RoutePlanDto>('/routes', { method: 'POST', body }),
  list: (date?: string) => api<RoutePlanDto[]>('/routes', { query: { date } }),
  /** The agent's plan for the day, or null if none was saved. */
  mine: (date?: string) =>
    api<RoutePlanDto>('/routes/mine', { query: { date } }).catch((error: unknown) => {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }),
};
