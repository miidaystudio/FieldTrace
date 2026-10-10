import type { Connectivity, Motion, ShiftStatus, TelemetryFlag, VehicleType } from './backend';

/**
 * Display status of an agent, derived from backend `connectivity` + `motion` + flags
 * (see adapters.ts → deriveStatus).
 */
export type AgentStatus = 'moving' | 'idle' | 'stopped' | 'stale' | 'flagged' | 'offline';

export type AgentType = VehicleType;

/** Latest telemetry of an agent. `null` = not reported by the device / backend. */
export interface Telemetry {
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  speedKmH: number;
  heading: number; // 0-360 degrees
  batteryPercent: number | null;
  signalStrengthDbm: number | null;
  timestamp: string | null;
  odometerKm: number | null;
}

export interface Agent {
  id: string;
  callsign: string;
  name: string;
  avatar: string;
  role: string;
  type: AgentType;
  status: AgentStatus;
  /** False until the agent has reported a GPS fix; such agents are not drawn on maps. */
  hasPosition: boolean;
  currentLat: number;
  currentLng: number;
  bearing: number;
  speedKmH: number;
  batteryLevel: number | null;
  signalStrength: number | null;
  teamId: string | null;
  email: string | null;
  shiftStatus: ShiftStatus;
  connectivity: Connectivity;
  motion: Motion | null;
  flags: TelemetryFlag[];
  assignedRouteId?: string;
  currentVisitId?: string;
  currentGeofenceId?: string;
  lastHeartbeat: string | null;
  phone: string | null;
  destinationName?: string;
  etaMinutes?: number;
  telemetry: Telemetry;
  anomalyFlag?: AnomalyType;
}

export type VisitStatus = 'verified' | 'pending' | 'flagged' | 'deviated';

export type VerificationMethod = 
  | 'geofence_auto' 
  | 'qr_scan' 
  | 'nfc_tap' 
  | 'photo_ai' 
  | 'manual_override';

export interface ProofOfVisit {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  siteId: string;
  siteName: string;
  clientName: string;
  address: string;
  scheduledTime: string;
  checkInTime: string;
  checkOutTime?: string;
  durationMinutes: number;
  status: VisitStatus;
  verificationMethod: VerificationMethod;
  gpsAccuracyMeters: number;
  deviationDistanceMeters: number;
  photoEvidenceUrl?: string;
  signatureUrl?: string;
  notes?: string;
  verifiedBy?: string;
  confidenceScore: number; // 0 to 100
  anomalyReason?: string;
  coordinates: [number, number]; // [lat, lng]
}

export type GeofenceType = 'polygon' | 'circle';

export interface Geofence {
  id: string;
  name: string;
  clientName: string;
  code: string;
  type: GeofenceType;
  center: [number, number];
  coordinates?: [number, number][]; // Polygon ring
  radiusMeters?: number; // For circle
  address: string;
  activeAgentsCount: number;
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
  autoVerifyToleranceMeters: number;
  gracePeriodMinutes: number;
  color?: string;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  timestamp: string;
  speedKmH: number;
  status: AgentStatus;
  telemetry?: Partial<Telemetry>;
}

export interface RouteStop {
  id: string;
  order: number;
  siteId: string;
  siteName: string;
  address: string;
  scheduledArrival: string;
  actualArrival?: string;
  estDurationMinutes: number;
  status: 'completed' | 'in_progress' | 'pending' | 'missed';
  coordinates: [number, number];
}

export interface RouteHistory {
  id: string;
  agentId: string;
  agentName: string;
  date: string;
  totalDistanceKm: number;
  durationMinutes: number;
  status: 'in_progress' | 'completed' | 'deviated';
  stops: RouteStop[];
  waypoints: RouteWaypoint[];
  deviationSegments?: {
    startIndex: number;
    endIndex: number;
    reason: string;
  }[];
}

export type AnomalyType = 
  | 'gps_spoof' 
  | 'speed_violation' 
  | 'route_deviation' 
  | 'stale_signal' 
  | 'idle_drain' 
  | 'geofence_bypass' 
  | 'mock_location';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface AnomalyEvent {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  timestamp: string;
  lat: number;
  lng: number;
  description: string;
  explanation: string; // Explainable AI rationale
  metricDetails: {
    recordedSpeed?: string;
    speedLimit?: string;
    jumpDistance?: string;
    deltaTime?: string;
    dwellDuration?: string;
    batteryDrainRate?: string;
    deviatedMeters?: number;
  };
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  actionTaken?: string;
}

/** Dashboard KPIs computed from live data. `null` = not available until a later backend phase. */
export interface KPIOverview {
  totalAgents: number;
  onShiftCount: number;
  movingCount: number;
  idleCount: number;
  flaggedCount: number;
  offlineCount: number;
  /** Visit verification arrives in Phase 3. */
  verifiedVisitsToday: number | null;
  pendingVisitsToday: number | null;
  assignmentsToday: number;
  completedAssignmentsToday: number;
  openAnomalies: number;
  /** Compliance scoring arrives with visits/anomalies (Phase 3–4). */
  complianceScore: number | null;
  avgSpeedKmH: number | null;
  totalDistanceKmToday: number | null;
}
