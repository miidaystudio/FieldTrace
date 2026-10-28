import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { AppError, ErrorCode } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getRealRedis } from '../lib/redis.js';
import { authenticateToken } from '../middleware/authenticate.js';
import { AgentProfile } from '../modules/agents/agent.model.js';
import { resolveTeamScope } from '../modules/teams/team.scope.js';
import type { Actor } from '../shared/types.js';
import {
  rooms,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SessionReadyPayload,
} from './events.js';
import { envelope, setPublisherServer } from './publisher.js';

interface SocketData {
  actor: Actor;
  tokenExpiresAt: number;
}

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Pub/sub connections of the Redis adapter, closed with the server. */
const adapterClients = new WeakMap<IoServer, Redis[]>();

/** Error passed to the client's `connect_error` handler: `err.message` + `err.data.code`. */
function connectError(code: string, message: string): Error & { data: { code: string } } {
  return Object.assign(new Error(message), { data: { code } });
}

/** Joins the rooms this user may receive events from. Rooms are never chosen by the client. */
async function joinScopedRooms(socket: IoSocket): Promise<SessionReadyPayload> {
  const { actor, tokenExpiresAt } = socket.data;
  // Personal channel (notifications) for every role.
  await socket.join(rooms.user(actor.orgId, actor.userId));
  const base = {
    userId: actor.userId,
    role: actor.role,
    tokenExpiresAt: new Date(tokenExpiresAt * 1000).toISOString(),
  };

  if (actor.role === 'admin') {
    await socket.join(rooms.organization(actor.orgId));
    return { ...base, scope: 'organization', teamIds: [] };
  }
  if (actor.role === 'manager') {
    const scope = await resolveTeamScope(actor);
    const teamIds = scope === 'all' ? [] : scope.map((id) => id.toString());
    await socket.join(teamIds.map((teamId) => rooms.team(actor.orgId, teamId)));
    return { ...base, scope: 'teams', teamIds };
  }
  const profile = await AgentProfile.findOne({ orgId: actor.orgId, userId: actor.userId })
    .select('_id')
    .lean();
  if (profile) await socket.join(rooms.agent(actor.orgId, profile._id.toString()));
  return { ...base, scope: 'self', teamIds: [] };
}

/**
 * Attaches Socket.IO to the HTTP server.
 *
 * Auth: `io(url, { auth: { token: accessToken } })`. The same checks as HTTP apply (signature,
 * expiry, live user/session status). When the access token expires the server emits
 * `auth:expired` and disconnects; the client refreshes and reconnects with the new token.
 *
 * Several API instances: with a real Redis the Socket.IO Redis adapter relays every emit to all
 * instances (pub/sub). On the in-memory Redis (development) it stays single-instance.
 */
export function initRealtime(httpServer: HttpServer): IoServer {
  const io: IoServer = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  const redis = getRealRedis();
  if (redis) {
    const pub = redis.duplicate();
    const sub = redis.duplicate();
    adapterClients.set(io, [pub, sub]);
    io.adapter(createAdapter(pub, sub, { key: `${env.REDIS_KEY_PREFIX}socket.io` }));
    logger.info('Socket.IO Redis adapter enabled (multi-instance)');
  }

  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    const token = typeof auth?.token === 'string' ? auth.token : undefined;
    authenticateToken(token, { requestId: `socket:${socket.id}`, ip: socket.handshake.address })
      .then(({ tokenExpiresAt, ...actor }) => {
        if (actor.mustChangePassword) {
          next(connectError(ErrorCode.PASSWORD_CHANGE_REQUIRED, 'Password change required'));
          return;
        }
        socket.data.actor = actor;
        socket.data.tokenExpiresAt = tokenExpiresAt;
        next();
      })
      .catch((error: unknown) => {
        if (error instanceof AppError) next(connectError(error.code, error.message));
        else {
          logger.error({ err: error }, 'Socket authentication failed');
          next(connectError(ErrorCode.INTERNAL_ERROR, 'Authentication failed'));
        }
      });
  });

  io.on('connection', (socket) => {
    const msUntilExpiry = socket.data.tokenExpiresAt * 1000 - Date.now();
    const expiryTimer = setTimeout(
      () => {
        socket.emit('auth:expired', envelope('auth:expired', { reason: 'token_expired' as const }));
        socket.disconnect(true);
      },
      Math.max(0, msUntilExpiry),
    );
    socket.on('disconnect', () => clearTimeout(expiryTimer));

    joinScopedRooms(socket)
      .then((ready) => socket.emit('session:ready', envelope('session:ready', ready)))
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Failed to join socket rooms');
        socket.disconnect(true);
      });
  });

  setPublisherServer(io);
  return io;
}

export async function closeRealtime(io: IoServer): Promise<void> {
  setPublisherServer(null);
  await io.close();
  await Promise.all(
    (adapterClients.get(io) ?? []).map((client) => client.quit().catch(() => 'OK')),
  );
}
