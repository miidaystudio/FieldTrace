import { describe, expect, it } from 'vitest';
import {
  computeConnectivity,
  motionOf,
  nextStationarySince,
  STOPPED_AFTER_MS,
  type LiveFix,
} from '../../src/modules/tracking/live-state.js';

const settings = { staleAfterSec: 60, offlineAfterSec: 300 };
const T0 = Date.parse('2026-10-09T10:00:00Z');

function fix(overrides: Partial<LiveFix>): LiveFix {
  return {
    agentId: 'a',
    teamId: null,
    sessionId: 's',
    lat: 12.97,
    lng: 77.59,
    accuracyM: 10,
    speedMps: 0,
    headingDeg: null,
    batteryPct: null,
    flags: [],
    recordedAt: T0,
    receivedAt: T0,
    stationarySince: T0,
    ...overrides,
  };
}

describe('connectivity', () => {
  it.each([
    ['on_shift', 10, 'online'],
    ['on_shift', 59, 'online'],
    ['on_shift', 60, 'stale'],
    ['on_break', 120, 'stale'],
    ['on_shift', 300, 'offline'],
    ['off_shift', 1, 'offline'],
  ] as const)('%s, last fix %ss ago -> %s', (shift, ageSec, expected) => {
    expect(computeConnectivity(shift, T0 - ageSec * 1000, T0, settings)).toBe(expected);
  });

  it('is offline when the agent never reported a fix', () => {
    expect(computeConnectivity('on_shift', null, T0, settings)).toBe('offline');
  });
});

describe('motion', () => {
  it('reported speed above threshold means moving', () => {
    const next = nextStationarySince(fix({}), {
      lat: 12.97,
      lng: 77.59,
      accuracyM: 5,
      speedMps: 3,
      recordedAt: T0 + 5000,
    });
    expect(next).toBeNull();
  });

  it('displacement beyond accuracy counts as moving even without speed', () => {
    const next = nextStationarySince(fix({}), {
      lat: 12.971,
      lng: 77.59,
      accuracyM: 5,
      speedMps: null,
      recordedAt: T0 + 60_000,
    });
    expect(next).toBeNull();
  });

  it('GPS jitter within accuracy keeps the stationary marker', () => {
    const next = nextStationarySince(fix({ stationarySince: T0 - 1000 }), {
      lat: 12.97005,
      lng: 77.59,
      accuracyM: 15,
      speedMps: 0.2,
      recordedAt: T0 + 5000,
    });
    expect(next).toBe(T0 - 1000);
  });

  it('idle becomes stopped after 5 minutes stationary', () => {
    expect(motionOf({ stationarySince: T0, recordedAt: T0 + 60_000 })).toBe('idle');
    expect(motionOf({ stationarySince: T0, recordedAt: T0 + STOPPED_AFTER_MS })).toBe('stopped');
    expect(motionOf({ stationarySince: null, recordedAt: T0 })).toBe('moving');
  });
});
