import { describe, expect, it } from 'vitest';
import { csvField, csvLine } from '../../src/modules/analytics/csv.js';
import {
  detectLongUnplannedStop,
  detectMockLocation,
  detectMotionAnomalies,
  detectOffHours,
  detectSignalGap,
  type RuleFix,
} from '../../src/modules/anomalies/detectors.js';
import {
  DEFAULT_ANOMALY_RULES,
  anomalyRulesOf,
} from '../../src/modules/organizations/organization.model.js';
import {
  addDays,
  daysBetween,
  isWithinWorkingHours,
  zonedDayBounds,
} from '../../src/shared/time.js';

const M = 1 / 111_320; // ≈ 1 m of latitude
const BASE = { lat: 12.9756, lng: 77.6063 };
const T0 = Date.UTC(2026, 9, 28, 6, 0, 0);

function fix(northM: number, sec: number, extra: Partial<RuleFix> = {}): RuleFix {
  return {
    lat: BASE.lat + northM * M,
    lng: BASE.lng,
    accuracyM: 8,
    recordedAtMs: T0 + sec * 1000,
    isMock: false,
    ...extra,
  };
}

const rules = DEFAULT_ANOMALY_RULES;

describe('motion rules', () => {
  it('ignores normal driving (50 km/h)', () => {
    const samples = [fix(0, 0), fix(140, 10), fix(280, 20)];
    expect(detectMotionAnomalies('a1', null, samples, rules)).toEqual([]);
  });

  it('flags implausible speed beyond GPS accuracy, with the numbers', () => {
    // 900 m in 15 s (minus 16 m accuracy) ≈ 212 km/h.
    const [finding] = detectMotionAnomalies('a1', fix(0, 0), [fix(900, 15)], rules);
    expect(finding).toMatchObject({
      type: 'impossible_speed',
      severity: 'high',
      dedupeKey: 'a1:impossible_speed',
      mode: 'merge',
    });
    expect(finding!.metrics.speedKmh).toBeGreaterThan(200);
    expect(finding!.explanation).toContain('km/h');
  });

  it('treats a large displacement within the interval as a GPS jump (not speed)', () => {
    const findings = detectMotionAnomalies(
      'a1',
      fix(0, 0),
      [fix(5000, 10), fix(10_000, 20)],
      rules,
    );
    expect(findings.map((f) => f.type)).toEqual(['gps_jump']);
    expect(findings[0]!.metrics.pairsInBatch).toBe(2);
    expect(findings[0]!.metrics.distanceM).toBeGreaterThan(4900);
  });

  it('does not judge fixes with poor accuracy or wobble within accuracy', () => {
    expect(
      detectMotionAnomalies('a1', fix(0, 0), [fix(5000, 10, { accuracyM: 500 })], rules),
    ).toEqual([]);
    // 30 m apart in 1 s, but accuracy ±20 m each: not movement.
    expect(
      detectMotionAnomalies(
        'a1',
        fix(0, 0, { accuracyM: 20 }),
        [fix(30, 6, { accuracyM: 20 })],
        rules,
      ),
    ).toEqual([]);
  });

  it('respects disabled rules', () => {
    const off = {
      impossibleSpeed: { ...rules.impossibleSpeed, enabled: false },
      gpsJump: { ...rules.gpsJump, enabled: false },
    };
    expect(detectMotionAnomalies('a1', fix(0, 0), [fix(5000, 10), fix(5900, 25)], off)).toEqual([]);
  });
});

describe('device, time and stop rules', () => {
  it('reports mock locations with counts', () => {
    const finding = detectMockLocation(
      'a1',
      [fix(0, 0), fix(1, 5, { isMock: true }), fix(2, 10, { isMock: true })],
      rules.mockLocation,
    );
    expect(finding).toMatchObject({ type: 'mock_location', severity: 'high' });
    expect(finding!.metrics).toMatchObject({ mockFixes: 2, fixesInBatch: 3 });
    expect(detectMockLocation('a1', [fix(0, 0)], rules.mockLocation)).toBeNull();
  });

  it('flags tracking outside working hours once per local day', () => {
    const hours = { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
    // 2026-10-28 is a Wednesday; 06:00 UTC = 11:30 IST (inside), 16:00 UTC = 21:30 IST (outside).
    expect(detectOffHours('a1', [fix(0, 0)], 'Asia/Kolkata', hours, rules.offHours)).toBeNull();
    const late = detectOffHours('a1', [fix(0, 10 * 3600)], 'Asia/Kolkata', hours, rules.offHours);
    expect(late).toMatchObject({
      type: 'off_hours_activity',
      dedupeKey: 'a1:off_hours:2026-10-28',
      mode: 'once',
    });
    expect(late!.metrics.localTime).toBe('21:30');
  });

  it('reports signal gaps and long stops only past their thresholds', () => {
    const lastSeen = T0;
    expect(detectSignalGap('a1', lastSeen, T0 + 5 * 60_000, null, rules.signalGap)).toBeNull();
    const gap = detectSignalGap('a1', lastSeen, T0 + 40 * 60_000, BASE, rules.signalGap);
    expect(gap).toMatchObject({ type: 'signal_gap', severity: 'high', mode: 'once' });
    expect(gap!.lastAt!.getTime()).toBe(T0 + 40 * 60_000);

    const stop = { position: BASE, stationarySinceMs: T0 };
    expect(
      detectLongUnplannedStop('a1', stop, T0 + 10 * 60_000, rules.longUnplannedStop),
    ).toBeNull();
    expect(
      detectLongUnplannedStop('a1', stop, T0 + 25 * 60_000, rules.longUnplannedStop),
    ).toMatchObject({
      type: 'long_unplanned_stop',
      severity: 'low',
      dedupeKey: `a1:long_stop:${T0}`,
    });
  });

  it('merges stored rules over the defaults', () => {
    const merged = anomalyRulesOf({ anomalyRules: { gpsJump: { enabled: false } as never } });
    expect(merged.gpsJump).toEqual({ ...DEFAULT_ANOMALY_RULES.gpsJump, enabled: false });
    expect(merged.signalGap).toEqual(DEFAULT_ANOMALY_RULES.signalGap);
    expect(anomalyRulesOf({})).toEqual(DEFAULT_ANOMALY_RULES);
  });
});

describe('time helpers', () => {
  it('computes local day bounds in UTC', () => {
    expect(zonedDayBounds('2026-10-28', 'Asia/Kolkata')).toEqual({
      start: new Date('2026-10-27T18:30:00.000Z'),
      end: new Date('2026-10-28T18:30:00.000Z'),
    });
    // DST change in New York (2026-11-01 is 25 hours long).
    const { start, end } = zonedDayBounds('2026-11-01', 'America/New_York');
    expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(25 * 3_600_000);
  });

  it('handles day arithmetic and overnight working hours', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-10-26', '2026-10-28')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
    const night = { start: '22:00', end: '06:00', days: [3] }; // Wednesday night shift
    // Thu 2026-10-29 02:00 IST belongs to Wednesday's shift.
    expect(isWithinWorkingHours(Date.UTC(2026, 9, 28, 20, 30), 'Asia/Kolkata', night)).toBe(true);
    expect(isWithinWorkingHours(Date.UTC(2026, 9, 29, 6, 30), 'Asia/Kolkata', night)).toBe(false);
  });
});

describe('csv', () => {
  it('quotes and neutralises spreadsheet formulas', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField(-5)).toBe('-5');
    expect(csvField(null)).toBe('');
    expect(csvLine(['a', 1, true])).toBe('a,1,true\r\n');
  });
});
