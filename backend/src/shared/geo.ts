import type { LatLng } from './schemas.js';

/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Ray-casting point-in-polygon on lat/lng treated as planar coordinates. Accurate enough for
 * geofences (hundreds of metres) away from the poles and the antimeridian.
 */
export function isPointInPolygon(point: LatLng, vertices: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i]!;
    const vj = vertices[j]!;
    const crosses =
      vi.lat > point.lat !== vj.lat > point.lat &&
      point.lng < ((vj.lng - vi.lng) * (point.lat - vi.lat)) / (vj.lat - vi.lat) + vi.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

function orientation(p: LatLng, q: LatLng, r: LatLng): number {
  const value = (q.lat - p.lat) * (r.lng - q.lng) - (q.lng - p.lng) * (r.lat - q.lat);
  if (Math.abs(value) < 1e-15) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(p1: LatLng, q1: LatLng, p2: LatLng, q2: LatLng): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  return o1 !== o2 && o3 !== o4;
}

/** True if any two non-adjacent edges of the (implicitly closed) ring cross. O(n²), n ≤ 100. */
export function isSelfIntersecting(vertices: LatLng[]): boolean {
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i]!;
    const a2 = vertices[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      // Skip edges that share a vertex.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsIntersect(a1, a2, vertices[j]!, vertices[(j + 1) % n]!)) return true;
    }
  }
  return false;
}
