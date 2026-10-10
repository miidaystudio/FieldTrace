import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import { logger } from '../lib/logger.js';
import {
  rooms,
  type AgentStatusPayload,
  type ClientToServerEvents,
  type EventEnvelope,
  type LocationUpdatePayload,
  type ServerToClientEvents,
} from './events.js';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

let io: IoServer | null = null;

/** Called by the realtime server on start/stop. Without a server, publishing is a no-op. */
export function setPublisherServer(server: IoServer | null): void {
  io = server;
}

export function envelope<T>(type: string, data: T): EventEnvelope<T> {
  return { v: 1, id: randomUUID(), type, ts: new Date().toISOString(), data };
}

/**
 * Sends an agent-related event to everyone allowed to see that agent: org admins, managers of
 * the agent's team, and the agent's own channel. Chained `.to()` de-duplicates sockets that
 * are in several of these rooms.
 */
function audience(orgId: string, agentId: string, teamId: string | null) {
  if (!io) return null;
  let target = io.to(rooms.organization(orgId)).to(rooms.agent(orgId, agentId));
  if (teamId) target = target.to(rooms.team(orgId, teamId));
  return target;
}

export function publishLocationUpdate(orgId: string, data: LocationUpdatePayload): void {
  try {
    audience(orgId, data.agentId, data.teamId)?.emit(
      'location:update',
      envelope('location:update', data),
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to publish location:update');
  }
}

export function publishAgentStatus(orgId: string, data: AgentStatusPayload): void {
  try {
    audience(orgId, data.agentId, data.teamId)?.emit(
      'agent:status',
      envelope('agent:status', data),
    );
  } catch (error) {
    logger.error({ err: error }, 'Failed to publish agent:status');
  }
}
