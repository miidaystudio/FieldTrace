import type { AnomalyType, Severity } from '../../shared/enums.js';
import { haversineMeters } from '../../shared/geo.js';
import type { LatLng } from '../../shared/schemas.js';
import { isWithinWorkingHours, zonedParts } from '../../shared/time.js';
import type { AnomalyRules } from '../organizations/organization.model.js';
import type { AnomalyMetrics } from './anomaly.model.js';

/**
 * Explainable anomaly rules. Pure functions: they turn GPS facts into findings with the numbers
 * that triggered them. Persisting, merging and publishing happen in anomaly.service.
 */

/** Fixes worse than this are too vague to judge speed or jumps (same limit as geofencing). */
export const MAX_RULE_ACCURACY_M = 100;
/** Speed over very short intervals is dominated by GPS noise. */
export const MIN_SPEED_INTERVAL_SEC = 5;

export interface Finding {
  type: AnomalyType;
  severity: Severity;
  /**
   * Same key while active → same record. `merge`: each repeat bumps `occurrences`;
   * `once`: a condition that lasts (a gap, a stop) is reported once and only its numbers update.
   */
  dedupeKey: string;
  mode: 'merge' | 'once';
  title: string;
  explanation: string;
  metrics: AnomalyMetrics;
  /** When the condition started / was observed. */
  at: Date;
  /** For lasting conditions: when it was last confirmed (defaults to `at`). */
  lastAt?: Date;
  position: LatLng | null;
  locationId?: string | null;
  visitId?: string | null;
}

export interface RuleFix extends LatLng {
  accuracyM: number;
  recordedAtMs: number;
  isMock: boolean;
}

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const hhmm = (ms: number, timeZone: string) => {
  const p = zonedParts(ms, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};

/**
 * Impossible speed and GPS jumps between consecutive fixes. The distance is reduced by both
 * fixes' accuracy first, so ordinary GPS wobble never counts. At most one finding per type per
 * batch (the worst pair), with the number of offending pairs.
 */
export function detectMotionAnomalies(
  agentId: string,
  previous: RuleFix | null,
  samples: RuleFix[],
  rules: Pick<AnomalyRules, 'impossibleSpeed' | 'gpsJump'>,
): Finding[] {
  let worstJump: { from: RuleFix; to: RuleFix; meters: number; sec: number } | null = null;
  let worstSpeed: { from: RuleFix; to: RuleFix; kmh: number; meters: number; sec: number } | null =
    null;
  let jumps = 0;
  let speeding = 0;

  let prev = previous;
  for (const fix of samples) {
    const from = prev;
    prev = fix;
    if (!from) continue;
    if (from.accuracyM > MAX_RULE_ACCURACY_M || fix.accuracyM > MAX_RULE_ACCURACY_M) continue;
    const sec = (fix.recordedAtMs - from.recordedAtMs) / 1000;
    if (sec <= 0) continue;
    const meters = haversineMeters(from, fix) - (from.accuracyM + fix.accuracyM);
    if (meters <= 0) continue;

    if (
      rules.gpsJump.enabled &&
      sec <= rules.gpsJump.maxIntervalSec &&
      meters >= rules.gpsJump.minDistanceM
    ) {
      jumps += 1;
      if (!worstJump || meters > worstJump.meters) worstJump = { from, to: fix, meters, sec };
      continue;
    }
    if (rules.impossibleSpeed.enabled && sec >= MIN_SPEED_INTERVAL_SEC) {
      const kmh = (meters / sec) * 3.6;
      if (kmh > rules.impossibleSpeed.maxSpeedKmh) {
        speeding += 1;
        if (!worstSpeed || kmh > worstSpeed.kmh) worstSpeed = { from, to: fix, kmh, meters, sec };
      }
    }
  }

  const findings: Finding[] = [];
  if (worstJump) {
    const { from, to, meters, sec } = worstJump;
    findings.push({
      type: 'gps_jump',
      severity: 'medium',
      dedupeKey: `${agentId}:gps_jump`,
      mode: 'merge',
      title: 'GPS position jumped',
      explanation:
        `The position moved ${round(meters / 1000, 2)} km in ${round(sec)} s (after subtracting ` +
        `GPS accuracy of ±${round(from.accuracyM)} m and ±${round(to.accuracyM)} m). This usually ` +
        'means a location spoofing tool, a device switch or a bad GPS fix.',
      metrics: {
        distanceM: round(meters),
        intervalSec: round(sec, 1),
        fromAccuracyM: round(from.accuracyM),
        toAccuracyM: round(to.accuracyM),
        pairsInBatch: jumps,
        thresholdDistanceM: rules.gpsJump.minDistanceM,
        thresholdIntervalSec: rules.gpsJump.maxIntervalSec,
      },
      at: new Date(to.recordedAtMs),
      position: { lat: to.lat, lng: to.lng },
    });
  }
  if (worstSpeed) {
    const { to, kmh, meters, sec } = worstSpeed;
    findings.push({
      type: 'impossible_speed',
      severity: 'high',
      dedupeKey: `${agentId}:impossible_speed`,
      mode: 'merge',
      title: 'Implausible travel speed',
      explanation:
        `Travelled ${round(meters)} m in ${round(sec)} s — ${round(kmh)} km/h, above the ` +
        `${rules.impossibleSpeed.maxSpeedKmh} km/h limit even after allowing for GPS accuracy.`,
      metrics: {
        speedKmh: round(kmh),
        distanceM: round(meters),
        intervalSec: round(sec, 1),
        pairsInBatch: speeding,
        thresholdKmh: rules.impossibleSpeed.maxSpeedKmh,
      },
      at: new Date(to.recordedAtMs),
      position: { lat: to.lat, lng: to.lng },
    });
  }
  return findings;
}

/** The device itself reported simulated (mock) locations. */
export function detectMockLocation(
  agentId: string,
  samples: RuleFix[],
  rule: AnomalyRules['mockLocation'],
): Finding | null {
  if (!rule.enabled) return null;
  const mock = samples.filter((sample) => sample.isMock);
  if (mock.length === 0) return null;
  const last = mock[mock.length - 1]!;
  return {
    type: 'mock_location',
    severity: 'high',
    dedupeKey: `${agentId}:mock_location`,
    mode: 'merge',
    title: 'Mock location reported by the device',
    explanation:
      `${mock.length} of ${samples.length} GPS fixes in this upload were marked as mock ` +
      '(simulated) by the phone. Positions from this device cannot be trusted until checked.',
    metrics: { mockFixes: mock.length, fixesInBatch: samples.length },
    at: new Date(last.recordedAtMs),
    position: { lat: last.lat, lng: last.lng },
  };
}

/** Tracking outside the organization's working hours (once per agent per local day). */
export function detectOffHours(
  agentId: string,
  samples: RuleFix[],
  timeZone: string,
  workingHours: { start: string; end: string; days: number[] },
  rule: AnomalyRules['offHours'],
): Finding | null {
  if (!rule.enabled) return null;
  const outside = samples.find(
    (sample) => !isWithinWorkingHours(sample.recordedAtMs, timeZone, workingHours),
  );
  if (!outside) return null;
  const p = zonedParts(outside.recordedAtMs, timeZone);
  const day = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return {
    type: 'off_hours_activity',
    severity: 'low',
    dedupeKey: `${agentId}:off_hours:${day}`,
    mode: 'once',
    title: 'Tracking outside working hours',
    explanation:
      `GPS was recorded at ${hhmm(outside.recordedAtMs, timeZone)} (${timeZone}), outside the ` +
      `working hours ${workingHours.start}–${workingHours.end}. Check whether the shift was ` +
      'approved overtime or left running by mistake.',
    metrics: {
      localTime: hhmm(outside.recordedAtMs, timeZone),
      localDay: day,
      workingHours: `${workingHours.start}-${workingHours.end}`,
    },
    at: new Date(outside.recordedAtMs),
    position: { lat: outside.lat, lng: outside.lng },
  };
}

/** On shift (not on break) but no GPS for a while. One record per silent period. */
export function detectSignalGap(
  agentId: string,
  lastSeenMs: number,
  nowMs: number,
  lastPosition: LatLng | null,
  rule: AnomalyRules['signalGap'],
): Finding | null {
  if (!rule.enabled) return null;
  const gapMin = (nowMs - lastSeenMs) / 60_000;
  if (gapMin < rule.minGapMin) return null;
  return {
    type: 'signal_gap',
    severity: gapMin >= rule.minGapMin * 3 ? 'high' : 'medium',
    dedupeKey: `${agentId}:signal_gap:${lastSeenMs}`,
    mode: 'once',
    title: 'No GPS signal during shift',
    explanation:
      `No location received for ${round(gapMin)} min while the agent is on shift (limit ` +
      `${rule.minGapMin} min). The phone may be off, in a dead zone, or tracking was blocked.`,
    metrics: {
      gapMin: round(gapMin),
      lastFixAt: new Date(lastSeenMs).toISOString(),
      thresholdMin: rule.minGapMin,
    },
    at: new Date(lastSeenMs),
    lastAt: new Date(nowMs),
    position: lastPosition,
  };
}

/** Stationary outside every client geofence for too long. One record per stop. */
export function detectLongUnplannedStop(
  agentId: string,
  stop: { position: LatLng; stationarySinceMs: number },
  nowMs: number,
  rule: AnomalyRules['longUnplannedStop'],
): Finding | null {
  if (!rule.enabled) return null;
  const stoppedMin = (nowMs - stop.stationarySinceMs) / 60_000;
  if (stoppedMin < rule.minStopMin) return null;
  return {
    type: 'long_unplanned_stop',
    severity: stoppedMin >= rule.minStopMin * 2 ? 'medium' : 'low',
    dedupeKey: `${agentId}:long_stop:${stop.stationarySinceMs}`,
    mode: 'once',
    title: 'Long stop away from client sites',
    explanation:
      `Stationary for ${round(stoppedMin)} min at a place that is not a client location ` +
      `(limit ${rule.minStopMin} min). Could be a break, traffic or an unplanned stop.`,
    metrics: {
      stoppedMin: round(stoppedMin),
      since: new Date(stop.stationarySinceMs).toISOString(),
      thresholdMin: rule.minStopMin,
    },
    at: new Date(stop.stationarySinceMs),
    lastAt: new Date(nowMs),
    position: stop.position,
  };
}
