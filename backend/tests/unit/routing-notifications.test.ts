import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  checkWebhookUrl,
  isPrivateAddress,
  signWebhook,
} from '../../src/modules/notifications/transports.js';
import {
  evaluate,
  optimizeOrder,
  type OptStop,
  type TravelMatrix,
} from '../../src/modules/routing/optimizer.js';
import { builtinMatrix } from '../../src/modules/routing/providers.js';

/** Points on a line, 1 km apart; travel 1 km = 100 s. Index 0 = start. */
function lineMatrix(positionsKm: number[]): TravelMatrix {
  const durations = positionsKm.map((a) => positionsKm.map((b) => Math.abs(a - b) * 100));
  const distances = positionsKm.map((a) => positionsKm.map((b) => Math.abs(a - b) * 1000));
  return { durations, distances };
}
const stop = (extra: Partial<OptStop> = {}): OptStop => ({
  serviceSec: 0,
  window: null,
  priority: 'normal',
  ...extra,
});
const T0 = Date.UTC(2026, 9, 28, 4, 0);

describe('route optimizer', () => {
  it('finds the obvious order on a line (no windows)', () => {
    // start 0 km; stops at 5, 1, 3 km → best is 1, 3, 5.
    const matrix = lineMatrix([0, 5, 1, 3]);
    const result = optimizeOrder([stop(), stop(), stop()], matrix, T0);
    expect(result.order).toEqual([1, 2, 0]);
    expect(result.distanceM).toBe(5000);
    expect(result.lateStops).toBe(0);
  });

  it('visits a stop with a closing window first, even if another is nearer', () => {
    // start 0; stop0 at +5 km must be reached within 10 min; stop1 at -3 km has no window.
    const matrix = lineMatrix([0, 5, -3]);
    const stops = [stop({ window: { start: T0, end: T0 + 600_000 }, priority: 'urgent' }), stop()];
    const nearestFirst = evaluate([1, 0], stops, matrix, T0, false);
    expect(nearestFirst.lateStops).toBe(1);
    const best = optimizeOrder(stops, matrix, T0);
    expect(best.order).toEqual([0, 1]);
    expect(best.lateStops).toBe(0);
  });

  it('waits for windows that open later and includes service and return legs', () => {
    const matrix = lineMatrix([0, 1]);
    const result = evaluate(
      [0],
      [stop({ serviceSec: 300, window: { start: T0 + 600_000, end: T0 + 3_600_000 } })],
      matrix,
      T0,
      true,
    );
    expect(result.stops[0]).toMatchObject({ waitSec: 500, lateSec: 0 });
    expect(result.returnLeg).toEqual({ sec: 100, m: 1000 });
    // 100 s travel + 500 s wait + 300 s service + 100 s back
    expect((result.finish - T0) / 1000).toBe(1000);
  });

  it('handles 20 stops quickly', () => {
    const positions = [0, ...Array.from({ length: 20 }, (_, i) => ((i * 7) % 20) + 1)];
    const startedAt = performance.now();
    const result = optimizeOrder(
      positions.slice(1).map(() => stop()),
      lineMatrix(positions),
      T0,
    );
    expect(performance.now() - startedAt).toBeLessThan(2000);
    expect(result.distanceM).toBe(20_000); // straight out along the line
  });

  it('builds a straight-line matrix with road factor and speed', () => {
    const m = builtinMatrix([
      { lat: 12.97, lng: 77.59 },
      { lat: 12.97 + 1 / 111.32, lng: 77.59 }, // ≈ 1 km north
    ]);
    expect(m.distances[0]![1]).toBeGreaterThan(1250);
    expect(m.distances[0]![1]).toBeLessThan(1350); // × 1.3
    expect(m.durations[0]![1]).toBeGreaterThan(180); // 1.3 km at 25 km/h ≈ 187 s
    expect(m.durations[1]![1]).toBe(0);
  });
});

describe('webhook safety', () => {
  it('recognises private and loopback addresses', () => {
    for (const ip of [
      '10.1.2.3',
      '127.0.0.1',
      '192.168.0.10',
      '172.20.0.1',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
      '100.64.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('validates URLs (development allows http/localhost)', async () => {
    expect(await checkWebhookUrl('http://localhost:9999/hook')).toBeNull();
    expect(await checkWebhookUrl('https://example.com/hook')).toBeNull();
    expect(await checkWebhookUrl('ftp://example.com')).toMatch(/http/);
    expect(await checkWebhookUrl('https://user:pass@example.com')).toMatch(/credentials/);
    expect(await checkWebhookUrl('not a url')).toMatch(/valid/);
  });

  it('signs timestamp + body with HMAC-SHA256', () => {
    const expected = createHmac('sha256', 'whsec_test').update('1700000000.{"a":1}').digest('hex');
    expect(signWebhook('whsec_test', '1700000000', '{"a":1}')).toBe(`sha256=${expected}`);
  });
});
