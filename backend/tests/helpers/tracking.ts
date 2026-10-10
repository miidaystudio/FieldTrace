import { expect } from 'vitest';
import { as } from './api.js';

export interface SampleInput {
  seq: number;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  /** Seconds relative to now (negative = past). */
  offsetSec?: number;
  recordedAt?: string;
  speedMps?: number | null;
  headingDeg?: number;
  batteryPct?: number;
  isMock?: boolean;
}

/** Bengaluru MG Road; samples default to here. */
export const ORIGIN = { lat: 12.9756, lng: 77.6063 };

export function sample(input: SampleInput) {
  return {
    seq: input.seq,
    lat: input.lat ?? ORIGIN.lat,
    lng: input.lng ?? ORIGIN.lng,
    accuracyM: input.accuracyM ?? 8,
    recordedAt:
      input.recordedAt ?? new Date(Date.now() + (input.offsetSec ?? -5) * 1000).toISOString(),
    ...(input.speedMps !== undefined ? { speedMps: input.speedMps } : {}),
    ...(input.headingDeg !== undefined ? { headingDeg: input.headingDeg } : {}),
    ...(input.batteryPct !== undefined ? { batteryPct: input.batteryPct } : {}),
    ...(input.isMock !== undefined ? { isMock: input.isMock } : {}),
  };
}

export async function startShift(agentToken: string): Promise<string> {
  const res = await as(agentToken)
    .post('/api/v1/shifts/start')
    .send({ device: { platform: 'web' } });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data.id as string;
}

export function sendTelemetry(agentToken: string, sessionId: string, samples: object[]) {
  return as(agentToken).post('/api/v1/telemetry').send({ sessionId, samples });
}
