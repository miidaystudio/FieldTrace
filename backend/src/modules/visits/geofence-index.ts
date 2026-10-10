import { toObjectId, toLatLng, idString, type LatLng } from '../../shared/schemas.js';
import { haversineMeters, isPointInPolygon } from '../../shared/geo.js';
import { ClientLocation } from '../locations/location.model.js';

/**
 * In-memory index of an organization's active geofences for the telemetry hot path.
 * Cached for a short TTL and invalidated whenever a location changes. A bounding-box prefilter
 * keeps the per-fix cost low; organizations with thousands of sites would move to Redis GEO.
 */
export interface IndexedGeofence {
  locationId: string;
  name: string;
  minDwellSec: number;
  requireQr: boolean;
  requirePhoto: boolean;
  center: LatLng;
  shape: 'circle' | 'polygon';
  radiusM: number | null;
  vertices: LatLng[] | null;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

const TTL_MS = 30_000;
/** Extra margin around each bounding box (covers exit buffers and GPS error). */
const BBOX_MARGIN_M = 150;
const METERS_PER_DEG_LAT = 111_320;

const cache = new Map<string, { fences: IndexedGeofence[]; expiresAt: number }>();

function bboxFor(points: LatLng[], marginM: number) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = marginM / METERS_PER_DEG_LAT;
  const dLng = marginM / (METERS_PER_DEG_LAT * Math.max(0.01, Math.cos((midLat * Math.PI) / 180)));
  return {
    minLat: Math.min(...lats) - dLat,
    maxLat: Math.max(...lats) + dLat,
    minLng: Math.min(...lngs) - dLng,
    maxLng: Math.max(...lngs) + dLng,
  };
}

export async function getOrgGeofences(orgId: string): Promise<IndexedGeofence[]> {
  const hit = cache.get(orgId);
  if (hit && hit.expiresAt > Date.now()) return hit.fences;

  const locations = await ClientLocation.find({ orgId: toObjectId(orgId), isArchived: false })
    .select('name point geofence visitRules')
    .lean();
  const fences = locations.map((location): IndexedGeofence => {
    const center = toLatLng(location.point.coordinates);
    const vertices =
      location.geofence.shape === 'polygon' && location.geofence.polygon
        ? (location.geofence.polygon.coordinates[0] ?? []).slice(0, -1).map(toLatLng)
        : null;
    const radiusM = location.geofence.shape === 'circle' ? location.geofence.radiusM : null;
    return {
      locationId: idString(location._id),
      name: location.name,
      minDwellSec: location.visitRules.minDwellSec,
      requireQr: location.visitRules.requireQr,
      requirePhoto: location.visitRules.requirePhoto,
      center,
      shape: location.geofence.shape,
      radiusM,
      vertices,
      bbox: vertices
        ? bboxFor(vertices, BBOX_MARGIN_M)
        : bboxFor([center], (radiusM ?? 0) + BBOX_MARGIN_M),
    };
  });
  cache.set(orgId, { fences, expiresAt: Date.now() + TTL_MS });
  return fences;
}

export function invalidateOrgGeofences(orgId: string): void {
  cache.delete(orgId);
}

const inBbox = (fence: IndexedGeofence, p: LatLng) =>
  p.lat >= fence.bbox.minLat &&
  p.lat <= fence.bbox.maxLat &&
  p.lng >= fence.bbox.minLng &&
  p.lng <= fence.bbox.maxLng;

/** Distance to the centre and whether the point is inside the geofence (no tolerance). */
export function containment(
  fence: IndexedGeofence,
  point: LatLng,
): { inside: boolean; distanceM: number } {
  const distanceM = haversineMeters(point, fence.center);
  if (fence.shape === 'circle') return { inside: distanceM <= (fence.radiusM ?? 0), distanceM };
  return { inside: isPointInPolygon(point, fence.vertices ?? []), distanceM };
}

/** Tolerance used for exits and manual check-ins: the reported accuracy, clamped to 10–50 m. */
export const accuracyBuffer = (accuracyM: number | null) =>
  Math.min(50, Math.max(10, accuracyM ?? 50));

/**
 * True only when the fix is outside by more than the GPS uncertainty — prevents flapping
 * enter/exit events when an agent stands near the boundary. (Polygons use the raw boundary.)
 */
export function isClearlyOutside(
  fence: IndexedGeofence,
  point: LatLng,
  accuracyM: number | null,
): boolean {
  const { inside, distanceM } = containment(fence, point);
  if (inside) return false;
  if (fence.shape === 'circle') return distanceM > (fence.radiusM ?? 0) + accuracyBuffer(accuracyM);
  return true;
}

/** Inside the geofence when the reported accuracy is given the benefit of the doubt. */
export function isWithinTolerance(
  fence: IndexedGeofence,
  point: LatLng,
  accuracyM: number | null,
): boolean {
  return !isClearlyOutside(fence, point, accuracyM);
}

/** The geofence containing the point (nearest centre wins when geofences overlap). */
export function findContaining(fences: IndexedGeofence[], point: LatLng): IndexedGeofence | null {
  let best: { fence: IndexedGeofence; distanceM: number } | null = null;
  for (const fence of fences) {
    if (!inBbox(fence, point)) continue;
    const { inside, distanceM } = containment(fence, point);
    if (inside && (!best || distanceM < best.distanceM)) best = { fence, distanceM };
  }
  return best?.fence ?? null;
}
