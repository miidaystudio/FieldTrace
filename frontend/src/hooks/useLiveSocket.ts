import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { AgentStatusPayload, EventEnvelope, LocationUpdatePayload } from '../api/backend';
import { API_BASE, getAccessToken, refreshSession } from '../api/client';
import { useFleetStore } from '../store/useFleetStore';

const MAX_REMEMBERED_EVENT_IDS = 1000;

/**
 * Connects the dashboard to the backend's Socket.IO stream (docs/realtime-and-tracking.md):
 * - authenticates with the in-memory access token; on `auth:expired` / TOKEN_EXPIRED it
 *   refreshes once and reconnects,
 * - reloads the REST snapshot after every (re)connect, because missed events are not replayed,
 * - drops duplicate envelopes by `id`.
 *
 * Mount once, inside the authenticated dashboard shell.
 */
export function useLiveSocket(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const store = useFleetStore.getState;
    const seen = new Set<string>();
    const isNew = (id: string) => {
      if (seen.has(id)) return false;
      seen.add(id);
      if (seen.size > MAX_REMEMBERED_EVENT_IDS) seen.delete(seen.values().next().value as string);
      return true;
    };

    const socket: Socket = io(API_BASE || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    const reauthenticate = async () => {
      const session = await refreshSession();
      if (session) socket.connect();
      else store().setSocketState('offline');
    };

    store().setSocketState('connecting');
    socket.on('connect', () => {
      store().setSocketState('connected');
      void store().refreshLive();
    });
    socket.on('disconnect', (reason) => {
      // `io server disconnect` = server closed it (token expiry); handled via auth:expired.
      store().setSocketState(reason === 'io client disconnect' ? 'offline' : 'reconnecting');
    });
    socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
      const code = error.data?.code;
      if (code === 'TOKEN_EXPIRED') void reauthenticate();
      else if (code === 'UNAUTHENTICATED' || code === 'PASSWORD_CHANGE_REQUIRED') {
        store().setSocketState('offline');
        socket.disconnect();
      } else store().setSocketState('reconnecting');
    });
    socket.on('auth:expired', () => void reauthenticate());

    socket.on('location:update', (event: EventEnvelope<LocationUpdatePayload>) => {
      if (!isNew(event.id)) return;
      store().handleLocationUpdate(event.data, Math.max(0, Date.now() - Date.parse(event.ts)));
    });
    socket.on('agent:status', (event: EventEnvelope<AgentStatusPayload>) => {
      if (!isNew(event.id)) return;
      store().handleAgentStatus(event.data);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      store().setSocketState('offline');
    };
  }, [enabled]);
}
