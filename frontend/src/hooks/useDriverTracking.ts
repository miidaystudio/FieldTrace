import { useCallback, useEffect, useRef, useState } from 'react';
import {
  shiftsApi,
  telemetryApi,
  type ShiftSessionDto,
  type TelemetrySampleInput,
} from '../api/backend';
import { ApiError, errorMessage } from '../api/client';

/** Queue a fix at most this often; also forces a fix this often while stationary. */
const SAMPLE_INTERVAL_MS = 5_000;
const UPLOAD_INTERVAL_MS = 10_000;
const MAX_BATCH = 50;
const MAX_QUEUE = 2_000;

export type GpsPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

export interface LastFix {
  lat: number;
  lng: number;
  accuracyM: number;
  recordedAt: string;
}

export interface UploadResult {
  at: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  serverSkewMs: number;
}

type BatteryManagerLike = { level: number };
const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }).getBattery;

// Offline queue + per-session sequence numbers survive reloads (the backend dedupes by seq).
const queueKey = (sessionId: string) => `fieldtrace.queue.${sessionId}`;
const seqKey = (sessionId: string) => `fieldtrace.seq.${sessionId}`;

function readQueue(sessionId: string): TelemetrySampleInput[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(sessionId)) ?? '[]') as TelemetrySampleInput[];
  } catch {
    return [];
  }
}

function writeQueue(sessionId: string, queue: TelemetrySampleInput[]): void {
  try {
    localStorage.setItem(queueKey(sessionId), JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    /* storage full or blocked: samples stay in memory only */
  }
}

function nextSeq(sessionId: string): number {
  let seq = Date.now();
  try {
    const previous = Number(localStorage.getItem(seqKey(sessionId)) ?? 0);
    seq = Math.max(previous + 1, 1);
    localStorage.setItem(seqKey(sessionId), String(seq));
  } catch {
    /* fall back to a time-based seq */
  }
  return seq;
}

/**
 * Driver-side tracking: shift lifecycle, browser GPS, an offline-safe sample queue and batched
 * uploads to `POST /telemetry` (see backend docs/realtime-and-tracking.md §1).
 *
 * Browsers pause GPS when the tab is hidden or the screen is off; the backend then shows the
 * agent as stale/offline, and queued samples are uploaded when the app is active again.
 */
export function useDriverTracking() {
  const [session, setSession] = useState<ShiftSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<GpsPermission>('geolocation' in navigator ? 'unknown' : 'unavailable');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<LastFix | null>(null);
  const [queueLength, setQueueLength] = useState(0);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const [uploadedThisSession, setUploadedThisSession] = useState(0);

  const lastQueuedAt = useRef(0);
  const uploading = useRef(false);
  const battery = useRef<number | null>(null);
  const sessionId = session?.isActive ? session.id : null;

  // ---- initial shift state
  useEffect(() => {
    shiftsApi
      .current()
      .then(({ session: current }) => setSession(current))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
    void getBattery?.call(navigator).then((manager) => {
      battery.current = Math.round(manager.level * 100);
    });
  }, []);

  const enqueue = useCallback(
    (position: GeolocationPosition) => {
      if (!sessionId) return;
      const now = Date.now();
      if (now - lastQueuedAt.current < SAMPLE_INTERVAL_MS - 250) return;
      lastQueuedAt.current = now;
      const { coords } = position;
      const sample: TelemetrySampleInput = {
        seq: nextSeq(sessionId),
        lat: coords.latitude,
        lng: coords.longitude,
        accuracyM: Math.round(coords.accuracy * 10) / 10,
        recordedAt: new Date(position.timestamp || now).toISOString(),
        speedMps: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
        headingDeg: coords.heading !== null && !Number.isNaN(coords.heading) ? coords.heading : null,
        altitudeM: coords.altitude,
        batteryPct: battery.current,
      };
      const queue = [...readQueue(sessionId), sample];
      writeQueue(sessionId, queue);
      setQueueLength(queue.length);
      setLastFix({ lat: sample.lat, lng: sample.lng, accuracyM: sample.accuracyM, recordedAt: sample.recordedAt });
    },
    [sessionId],
  );

  const flush = useCallback(async () => {
    if (!sessionId || uploading.current || !navigator.onLine) return;
    const queue = readQueue(sessionId);
    if (queue.length === 0) return;
    uploading.current = true;
    const batch = queue.slice(0, MAX_BATCH);
    try {
      const result = await telemetryApi.send(sessionId, batch);
      // Accepted, duplicate AND rejected samples are all final — drop the whole batch.
      const sent = new Set(batch.map((s) => s.seq));
      const remaining = readQueue(sessionId).filter((s) => !sent.has(s.seq));
      writeQueue(sessionId, remaining);
      setQueueLength(remaining.length);
      setUploadedThisSession((count) => count + result.accepted);
      setLastUpload({
        at: new Date().toISOString(),
        accepted: result.accepted,
        duplicates: result.duplicates,
        rejected: result.rejected.length,
        serverSkewMs: Date.parse(result.serverTime) - Date.now(),
      });
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SHIFT_NOT_ACTIVE') {
        writeQueue(sessionId, []);
        setQueueLength(0);
        setSession(null);
        setError('Your shift was ended on the server. Start a new shift to keep tracking.');
      } else {
        setError(`Upload failed, will retry: ${errorMessage(err)}`);
      }
    } finally {
      uploading.current = false;
    }
  }, [sessionId]);

  // ---- GPS + upload loops while on shift
  useEffect(() => {
    if (!sessionId || !('geolocation' in navigator)) return;
    setQueueLength(readQueue(sessionId).length);
    const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 };
    const onPosition = (position: GeolocationPosition) => {
      setPermission('granted');
      setGpsError(null);
      enqueue(position);
    };
    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) setPermission('denied');
      setGpsError(err.message || 'Location unavailable');
    };
    const watchId = navigator.geolocation.watchPosition(onPosition, onError, options);
    // watchPosition may stay silent while stationary; poll so the agent stays "online".
    const poll = setInterval(() => navigator.geolocation.getCurrentPosition(onPosition, onError, options), SAMPLE_INTERVAL_MS);
    const upload = setInterval(() => void flush(), UPLOAD_INTERVAL_MS);
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(poll);
      clearInterval(upload);
      window.removeEventListener('online', onOnline);
    };
  }, [sessionId, enqueue, flush]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startShift = () =>
    run(async () => {
      setSession(await shiftsApi.start());
      setUploadedThisSession(0);
    });

  const endShift = () =>
    run(async () => {
      await flush();
      const ended = await shiftsApi.end();
      if (sessionId) writeQueue(sessionId, []);
      setQueueLength(0);
      setSession(ended);
    });

  const setBreak = (onBreak: boolean) =>
    run(async () => {
      setSession(await shiftsApi.setBreak(onBreak));
    });

  return {
    session,
    onShift: Boolean(session?.isActive),
    loading,
    busy,
    error,
    permission,
    gpsError,
    lastFix,
    queueLength,
    lastUpload,
    uploadedThisSession,
    startShift,
    endShift,
    setBreak,
    flush,
  };
}
