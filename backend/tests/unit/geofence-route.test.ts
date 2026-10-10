import { describe, expect, it } from 'vitest';
import {
  findContaining,
  isClearlyOutside,
  type IndexedGeofence,
} from '../../src/modules/visits/geofence-index.js';
import {
  detectGaps,
  detectStops,
  isOutOfOrder,
} from '../../src/modules/visits/route-analysis.service.js';

const CENTER = { lat: 12.9756, lng: 77.6063 };
/** ~1 m in degrees of latitude. */
const M = 1 / 111_320;

function circle(id: string, center = CENTER, radiusM = 100): IndexedGeofence {
  return {
    locationId: id,
    name: id,
    minDwellSec: 60,
    requireQr: false,
    requirePhoto: false,
    center,
    shape: 'circle',
    radiusM,
    vertices: null,
    bbox: {
      minLat: center.lat - 0.01,
      maxLat: center.lat + 0.01,
      minLng: center.lng - 0.01,
      maxLng: center.lng + 0.01,
    },
  };
}

describe('geofence geometry', () => {
  it('uses the GPS accuracy (clamped 10–50 m) as an exit buffer', () => {
    const fence = circle('a');
    const justOutside = { lat: CENTER.lat + 105 * M, lng: CENTER.lng };
    expect(isClearlyOutside(fence, justOutside, 8)).toBe(false); // within the 10 m minimum buffer
    expect(isClearlyOutside(fence, { lat: CENTER.lat + 115 * M, lng: CENTER.lng }, 8)).toBe(true);
    expect(isClearlyOutside(fence, { lat: CENTER.lat + 140 * M, lng: CENTER.lng }, 500)).toBe(
      false,
    ); // buffer capped at 50
    expect(isClearlyOutside(fence, { lat: CENTER.lat + 160 * M, lng: CENTER.lng }, 500)).toBe(true);
  });

  it('picks the nearest geofence when they overlap', () => {
    const near = circle('near', { lat: CENTER.lat + 30 * M, lng: CENTER.lng });
    const far = circle('far', { lat: CENTER.lat + 90 * M, lng: CENTER.lng });
    expect(
      findContaining([far, near], { lat: CENTER.lat + 40 * M, lng: CENTER.lng })?.locationId,
    ).toBe('near');
    expect(findContaining([far, near], { lat: CENTER.lat + 500 * M, lng: CENTER.lng })).toBeNull();
  });
});

describe('route analysis', () => {
  const at = (sec: number, dLatM = 0) => ({
    lat: CENTER.lat + dLatM * M,
    lng: CENTER.lng,
    t: sec * 1000,
  });

  it('detects stays of at least 3 minutes within 50 m as stops', () => {
    const points = [
      at(0, 0),
      at(60, 400), // driving
      ...Array.from({ length: 8 }, (_, k) => at(120 + k * 30, 400 + (k % 2) * 10)), // 210 s jittering in place
      at(400, 900),
    ];
    const stops = detectStops(points);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.end - stops[0]!.start).toBe(270_000);
    expect(detectStops([at(0), at(60), at(120)])).toHaveLength(0); // only 2 min
  });

  it('reports GPS gaps longer than 2 minutes', () => {
    expect(detectGaps([at(0), at(30), at(200), at(230)])).toEqual([{ from: 30_000, to: 200_000 }]);
  });

  it('detects out-of-order visits', () => {
    expect(isOutOfOrder([1, 2, null, 3])).toBe(false);
    expect(isOutOfOrder([2, 1, 3])).toBe(true);
  });
});
