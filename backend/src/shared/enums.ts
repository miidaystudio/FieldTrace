/**
 * Shared enums — the single source of truth for status values used across the API,
 * Socket.IO payloads and the frontend. Documented in docs/api-conventions.md.
 */
export const ROLES = ['admin', 'manager', 'agent'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['active', 'deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SHIFT_STATUSES = ['off_shift', 'on_shift', 'on_break'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

/**
 * Freshness of an agent's location, derived from the last fix age and the organization's
 * `staleAfterSec` / `offlineAfterSec` settings. Agents off shift are always `offline`.
 */
export const CONNECTIVITY_STATUSES = ['online', 'stale', 'offline'] as const;
export type ConnectivityStatus = (typeof CONNECTIVITY_STATUSES)[number];

/**
 * Movement derived from recent fixes: `moving` (≥ 1.5 m/s or displaced), `idle` (stationary
 * < 5 min), `stopped` (stationary ≥ 5 min). Shown separately from connectivity.
 */
export const MOTION_STATUSES = ['moving', 'idle', 'stopped'] as const;
export type MotionStatus = (typeof MOTION_STATUSES)[number];

/** Quality flags attached to individual GPS samples (evidence for Phase 4 anomaly rules). */
export const TELEMETRY_FLAGS = ['low_accuracy', 'mock_location'] as const;
export type TelemetryFlag = (typeof TELEMETRY_FLAGS)[number];

/** Why a submitted GPS sample was not stored. */
export const TELEMETRY_REJECT_REASONS = [
  'future_timestamp',
  'too_old',
  'before_shift',
  'duplicate_in_batch',
] as const;
export type TelemetryRejectReason = (typeof TELEMETRY_REJECT_REASONS)[number];

export const DEVICE_PLATFORMS = ['android', 'ios', 'web', 'simulator', 'other'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const ASSIGNMENT_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'overdue',
  'cancelled',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type AssignmentPriority = (typeof ASSIGNMENT_PRIORITIES)[number];

export const GEOFENCE_SHAPES = ['circle', 'polygon'] as const;
export type GeofenceShape = (typeof GEOFENCE_SHAPES)[number];

export const VEHICLE_TYPES = ['none', 'bicycle', 'motorcycle', 'car', 'van', 'truck'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

// Reserved for later phases; defined now so the contract is stable.
export const VISIT_STATUSES = [
  'pending',
  'in_progress',
  'verified',
  'needs_review',
  'missed',
  'rejected',
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** How a visit was opened: automatically from GPS dwell, or by the agent's check-in button. */
export const VISIT_METHODS = ['auto', 'manual'] as const;
export type VisitMethod = (typeof VISIT_METHODS)[number];

/**
 * Why a visit was not auto-verified. A GPS fix inside a geofence is evidence of proximity, not
 * proof of a visit — any of these sends the visit to a human reviewer (`needs_review`).
 */
export const VISIT_REVIEW_REASONS = [
  'low_accuracy',
  'mock_location',
  'insufficient_dwell',
  'signal_lost',
  'checkin_outside_geofence',
  'no_gps_presence',
  'evidence_required',
] as const;
export type VisitReviewReason = (typeof VISIT_REVIEW_REASONS)[number];

export const VISIT_EVIDENCE_TYPES = [
  'geofence_entry',
  'geofence_exit',
  'manual_checkin',
  'manual_checkout',
] as const;
export type VisitEvidenceType = (typeof VISIT_EVIDENCE_TYPES)[number];

export const GEOFENCE_EVENT_TYPES = ['entered', 'exited'] as const;
export type GeofenceEventType = (typeof GEOFENCE_EVENT_TYPES)[number];

export const ANOMALY_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const;
export type AnomalyStatus = (typeof ANOMALY_STATUSES)[number];

export const ALERT_STATUSES = [
  'open',
  'acknowledged',
  'investigating',
  'resolved',
  'dismissed',
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
