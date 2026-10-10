/**
 * Maps backend DTOs onto the UI's domain types (api/types.ts), so pages and map components
 * keep working with one shape regardless of where the data came from (REST snapshot or socket).
 */
import type {
  AgentDto,
  AgentStatusPayload,
  AssignmentDto,
  Connectivity,
  LiveAgentDto,
  LocationDto,
  LocationUpdatePayload,
  Motion,
  TelemetryFlag,
  TrackPointDto,
  VehicleType,
  VisitReviewReason,
} from './backend';
import type { Agent, AgentStatus, Geofence, RouteStop, RouteWaypoint } from './types';

const MPS_TO_KMH = 3.6;

/** Plain-language explanations of why a visit needs review (shown to managers and agents). */
export const REASON_LABELS: Record<VisitReviewReason, string> = {
  low_accuracy: 'GPS accuracy was poor while inside',
  mock_location: 'Device reported a mock (fake) location',
  insufficient_dwell: 'Stayed less than the minimum dwell time',
  signal_lost: 'GPS signal was lost while inside',
  checkin_outside_geofence: 'Checked in outside the geofence',
  no_gps_presence: 'No GPS fixes inside the geofence',
  evidence_required: 'Site requires photo/QR evidence (not collected yet)',
};


export const VEHICLE_LABELS: Record<VehicleType, string> = {
  none: 'On foot',
  bicycle: 'Bicycle',
  motorcycle: 'Motorcycle',
  car: 'Car',
  van: 'Van',
  truck: 'Truck',
};

/** Deterministic initials avatar (inline SVG, no external image service). */
export function avatarFor(name: string): string {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?';
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>` +
    `<rect width='64' height='64' fill='hsl(${hue},45%,28%)'/>` +
    `<text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' ` +
    `font-family='Inter,Arial,sans-serif' font-size='26' font-weight='700' fill='hsl(${hue},80%,85%)'>${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function deriveStatus(
  connectivity: Connectivity,
  motion: Motion | null,
  flags: TelemetryFlag[],
): AgentStatus {
  if (connectivity === 'offline') return 'offline';
  if (connectivity === 'stale') return 'stale';
  if (flags.includes('mock_location')) return 'flagged';
  return motion ?? 'idle';
}

const kmh = (mps: number | null) => (mps === null ? 0 : Math.round(mps * MPS_TO_KMH));

/** Live snapshot entry (+ optional directory profile for phone/email) → UI Agent. */
export function toAgent(live: LiveAgentDto, profile?: AgentDto, destinationName?: string): Agent {
  const speedKmH = kmh(live.speedMps);
  const heading = Math.round(live.headingDeg ?? 0);
  return {
    id: live.agentId,
    callsign: live.employeeCode ?? live.agentId.slice(-6).toUpperCase(),
    name: live.name,
    avatar: avatarFor(live.name),
    role: [VEHICLE_LABELS[live.vehicle.type], live.vehicle.plate].filter(Boolean).join(' · '),
    type: live.vehicle.type,
    status: deriveStatus(live.connectivity, live.motion, live.flags),
    hasPosition: live.position !== null,
    currentLat: live.position?.lat ?? 0,
    currentLng: live.position?.lng ?? 0,
    bearing: heading,
    speedKmH,
    batteryLevel: live.batteryPct === null ? null : Math.round(live.batteryPct),
    signalStrength: null,
    teamId: live.teamId,
    email: profile?.email ?? null,
    shiftStatus: live.shiftStatus,
    connectivity: live.connectivity,
    motion: live.motion,
    flags: live.flags,
    lastHeartbeat: live.lastSeenAt,
    phone: profile?.phone ?? null,
    destinationName,
    telemetry: {
      accuracyMeters: live.accuracyM,
      altitudeMeters: null,
      speedKmH,
      heading,
      batteryPercent: live.batteryPct,
      signalStrengthDbm: null,
      timestamp: live.recordedAt,
      odometerKm: null,
    },
  };
}

export function applyLocationUpdate(agent: Agent, update: LocationUpdatePayload): Agent {
  const speedKmH = kmh(update.speedMps);
  const heading = update.headingDeg === null ? agent.bearing : Math.round(update.headingDeg);
  // A fresh fix means the agent is reporting; the status sweep corrects this if it goes silent.
  const connectivity: Connectivity = agent.shiftStatus === 'off_shift' ? agent.connectivity : 'online';
  return {
    ...agent,
    hasPosition: true,
    currentLat: update.position.lat,
    currentLng: update.position.lng,
    bearing: heading,
    speedKmH,
    batteryLevel: update.batteryPct === null ? agent.batteryLevel : Math.round(update.batteryPct),
    connectivity,
    motion: update.motion,
    flags: update.flags,
    status: deriveStatus(connectivity, update.motion, update.flags),
    lastHeartbeat: update.recordedAt,
    telemetry: {
      ...agent.telemetry,
      accuracyMeters: update.accuracyM,
      speedKmH,
      heading,
      batteryPercent: update.batteryPct ?? agent.telemetry.batteryPercent,
      timestamp: update.recordedAt,
    },
  };
}

export function applyAgentStatus(agent: Agent, update: AgentStatusPayload): Agent {
  return {
    ...agent,
    shiftStatus: update.shiftStatus,
    connectivity: update.connectivity,
    lastHeartbeat: update.lastSeenAt ?? agent.lastHeartbeat,
    status: deriveStatus(update.connectivity, agent.motion, agent.flags),
  };
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function insidePolygon(point: { lat: number; lng: number }, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]!;
    const [yj, xj] = ring[j]!;
    if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Client location + its geofence → UI Geofence, counting agents currently inside. */
export function toGeofence(location: LocationDto, agents: Agent[]): Geofence {
  const center: [number, number] = [location.position.lat, location.position.lng];
  const isCircle = location.geofence.shape === 'circle';
  const radius = location.geofence.shape === 'circle' ? location.geofence.radiusM : undefined;
  const ring =
    location.geofence.shape === 'polygon'
      ? location.geofence.vertices.map((v): [number, number] => [v.lat, v.lng])
      : undefined;

  const inside = agents.filter((agent) => {
    if (!agent.hasPosition || agent.connectivity === 'offline') return false;
    const point = { lat: agent.currentLat, lng: agent.currentLng };
    return isCircle ? distanceMeters(point, location.position) <= (radius ?? 0) : insidePolygon(point, ring ?? []);
  }).length;

  return {
    id: location.id,
    name: location.name,
    clientName: location.contact.name ?? location.address ?? '—',
    code: location.externalRef ?? location.id.slice(-6).toUpperCase(),
    type: location.geofence.shape,
    center,
    coordinates: ring,
    radiusMeters: radius,
    address: location.address ?? '',
    activeAgentsCount: inside,
    riskLevel: 'low',
    tags: location.tags,
    autoVerifyToleranceMeters: radius ?? 0,
    gracePeriodMinutes: Math.round(location.visitRules.minDwellSec / 60),
  };
}

export function toWaypoints(points: TrackPointDto[]): RouteWaypoint[] {
  return points.map((point) => {
    const speedKmH = kmh(point.speedMps);
    return {
      lat: point.lat,
      lng: point.lng,
      timestamp: point.recordedAt,
      speedKmH,
      status: point.flags.includes('mock_location') ? 'flagged' : speedKmH >= 5 ? 'moving' : 'idle',
      telemetry: { accuracyMeters: point.accuracyM, heading: Math.round(point.headingDeg ?? 0) },
    };
  });
}

const timeOf = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

/** An agent's assignments of one day → ordered route stops (planned sequence). */
export function toRouteStops(assignments: AssignmentDto[]): RouteStop[] {
  return [...assignments]
    .filter((a) => a.location)
    .sort((a, b) => (a.window?.start ?? a.createdAt).localeCompare(b.window?.start ?? b.createdAt))
    .map((assignment, index) => {
      const completedAt = assignment.statusHistory.find((h) => h.status === 'completed')?.at;
      return {
        id: assignment.id,
        order: index + 1,
        siteId: assignment.locationId,
        siteName: assignment.location!.name,
        address: assignment.location!.address ?? '',
        scheduledArrival: timeOf(assignment.window?.start),
        actualArrival: completedAt ? timeOf(completedAt) : undefined,
        estDurationMinutes: 0,
        status:
          assignment.status === 'completed'
            ? 'completed'
            : assignment.status === 'in_progress'
              ? 'in_progress'
              : assignment.status === 'cancelled' || assignment.status === 'overdue'
                ? 'missed'
                : 'pending',
        coordinates: [assignment.location!.position.lat, assignment.location!.position.lng],
      };
    });
}

/** Today's calendar day in the organization's timezone (assignments use org-local dates). */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

// ------------------------------------------------------------------ formatting

export const fmt = (value: number | null | undefined, suffix = '', digits = 0): string =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : `${value.toFixed(digits)}${suffix}`;

export const fmtTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleTimeString() : '—';

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const sec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86_400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86_400)}d ago`;
}
