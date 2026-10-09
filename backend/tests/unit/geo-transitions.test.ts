import { describe, expect, it } from 'vitest';
import { canTransition } from '../../src/modules/assignments/assignment.transitions.js';
import { haversineMeters, isPointInPolygon, isSelfIntersecting } from '../../src/shared/geo.js';

const square = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 1, lng: 1 },
  { lat: 1, lng: 0 },
];

describe('geo helpers', () => {
  it('haversine distance matches a known value (Bengaluru → Delhi ≈ 1740 km)', () => {
    const d = haversineMeters({ lat: 12.9716, lng: 77.5946 }, { lat: 28.6139, lng: 77.209 });
    expect(d / 1000).toBeGreaterThan(1735);
    expect(d / 1000).toBeLessThan(1745);
  });

  it('point in polygon', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, square)).toBe(true);
    expect(isPointInPolygon({ lat: 1.5, lng: 0.5 }, square)).toBe(false);
  });

  it('detects self-intersecting (bow-tie) polygons', () => {
    expect(isSelfIntersecting(square)).toBe(false);
    expect(isSelfIntersecting([square[0]!, square[2]!, square[1]!, square[3]!])).toBe(true);
  });
});

describe('assignment transitions', () => {
  it.each([
    ['pending', 'in_progress', 'manager', true],
    ['pending', 'cancelled', 'manager', true],
    ['in_progress', 'completed', 'agent', true],
    ['pending', 'cancelled', 'agent', false],
    ['completed', 'in_progress', 'admin', false],
    ['cancelled', 'pending', 'admin', false],
    ['in_progress', 'pending', 'admin', false],
  ] as const)('%s → %s by %s allowed=%s', (from, to, role, allowed) => {
    expect(canTransition(from, to, role)).toBe(allowed);
  });
});
