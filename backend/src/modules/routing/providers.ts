import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { haversineMeters } from '../../shared/geo.js';
import type { LatLng } from '../../shared/schemas.js';
import type { TravelMatrix } from './optimizer.js';

export type ProviderName = 'openrouteservice' | 'builtin';

export interface RoutingResult {
  provider: ProviderName;
  /** Why the preferred provider was not used (no key, error…), or null. */
  fallbackReason: string | null;
  matrix: TravelMatrix;
}

const TIMEOUT_MS = 10_000;

/**
 * Straight-line distance × road factor at an average speed. No traffic, no road network: good
 * enough to sequence stops, but ETAs are estimates — the UI says so.
 */
export function builtinMatrix(points: LatLng[]): TravelMatrix {
  const speedMps = env.ROUTING_AVG_SPEED_KMH / 3.6;
  const distances = points.map((a) =>
    points.map((b) => Math.round(haversineMeters(a, b) * env.ROUTING_ROAD_FACTOR)),
  );
  const durations = distances.map((row) => row.map((m) => Math.round(m / speedMps)));
  return { durations, distances };
}

async function orsMatrix(points: LatLng[]): Promise<TravelMatrix> {
  const res = await fetch(`${env.ORS_BASE_URL}/v2/matrix/driving-car`, {
    method: 'POST',
    headers: { Authorization: env.ORS_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: points.map((p) => [p.lng, p.lat]),
      metrics: ['distance', 'duration'],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenRouteService matrix responded ${res.status}`);
  const body = (await res.json()) as {
    durations?: (number | null)[][];
    distances?: (number | null)[][];
  };
  if (!body.durations || !body.distances) throw new Error('OpenRouteService matrix incomplete');
  // Unroutable pairs (null) fall back to the straight-line estimate for that cell.
  const estimate = builtinMatrix(points);
  return {
    durations: body.durations.map((row, i) =>
      row.map((v, j) => (v === null ? estimate.durations[i]![j]! : Math.round(v))),
    ),
    distances: body.distances.map((row, i) =>
      row.map((v, j) => (v === null ? estimate.distances[i]![j]! : Math.round(v))),
    ),
  };
}

/** Travel matrix from OpenRouteService when configured, else (or on failure) the built-in one. */
export async function travelMatrix(points: LatLng[]): Promise<RoutingResult> {
  if (!env.ORS_API_KEY) {
    return {
      provider: 'builtin',
      fallbackReason: 'ORS_API_KEY not configured',
      matrix: builtinMatrix(points),
    };
  }
  try {
    return { provider: 'openrouteservice', fallbackReason: null, matrix: await orsMatrix(points) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn({ reason }, 'Routing provider failed; using built-in estimates');
    return { provider: 'builtin', fallbackReason: reason, matrix: builtinMatrix(points) };
  }
}

/** Road geometry through the points in order (ORS), or straight segments. */
export async function routeGeometry(points: LatLng[], provider: ProviderName): Promise<LatLng[]> {
  if (provider !== 'openrouteservice' || points.length < 2) return points;
  try {
    const res = await fetch(`${env.ORS_BASE_URL}/v2/directions/driving-car/geojson`, {
      method: 'POST',
      headers: { Authorization: env.ORS_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`OpenRouteService directions responded ${res.status}`);
    const body = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const coordinates = body.features?.[0]?.geometry?.coordinates;
    if (!coordinates?.length) throw new Error('no geometry');
    return coordinates.map(([lng, lat]) => ({ lat, lng }));
  } catch (error) {
    logger.warn({ err: error }, 'Route geometry unavailable; drawing straight segments');
    return points;
  }
}
