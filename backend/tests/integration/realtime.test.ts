import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeRealtime, initRealtime } from '../../src/realtime/io.js';
import {
  activate,
  app,
  as,
  createAgent,
  createManager,
  createTeam,
  registerOrg,
  type OrgFixture,
} from '../helpers/api.js';
import { sample, sendTelemetry, startShift } from '../helpers/tracking.js';

interface Envelope {
  v: number;
  id: string;
  type: string;
  ts: string;
  data: Record<string, unknown>;
}

describe('Socket.IO realtime', () => {
  let httpServer: HttpServer;
  let io: ReturnType<typeof initRealtime>;
  let url: string;
  const sockets: Socket[] = [];

  let org: OrgFixture;
  let otherOrg: OrgFixture;
  let managerToken: string;
  let north: { id: string; token: string; teamId: string };
  let south: { id: string; token: string };

  function connect(token?: string): Socket {
    const socket = connectClient(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return socket;
  }

  function nextEvent(socket: Socket, event: string, timeoutMs = 3000): Promise<Envelope> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`timed out waiting for ${event}`)),
        timeoutMs,
      );
      socket.once(event, (payload: Envelope) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  /** Collects every event of a type for later assertions. */
  function collect(socket: Socket, event: string): Envelope[] {
    const received: Envelope[] = [];
    socket.on(event, (payload: Envelope) => received.push(payload));
    return received;
  }

  async function ready(token: string): Promise<{ socket: Socket; session: Envelope }> {
    const socket = connect(token);
    const session = await nextEvent(socket, 'session:ready');
    return { socket, session };
  }

  beforeAll(async () => {
    httpServer = createServer(app);
    io = initRealtime(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

    org = await registerOrg('Realtime Org');
    otherOrg = await registerOrg('Realtime Other Org');
    const manager = await createManager(org.adminToken);
    managerToken = manager.token;
    const northTeam = await createTeam(org.adminToken, 'North', [manager.id]);
    const southTeam = await createTeam(org.adminToken, 'South');
    const n = await createAgent(org.adminToken, northTeam);
    const s = await createAgent(org.adminToken, southTeam);
    north = { id: n.id, token: await activate(n.email), teamId: northTeam };
    south = { id: s.id, token: await activate(s.email) };
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await closeRealtime(io);
  });

  it('rejects connections without a valid token', async () => {
    const socket = connect();
    const error = await new Promise<Error & { data?: { code: string } }>((resolve) =>
      socket.once('connect_error', resolve),
    );
    expect(error.data?.code).toBe('UNAUTHENTICATED');

    const bad = connect('not-a-jwt');
    const badError = await new Promise<Error & { data?: { code: string } }>((resolve) =>
      bad.once('connect_error', resolve),
    );
    expect(badError.data?.code).toBe('UNAUTHENTICATED');
  });

  it('assigns rooms by role (never chosen by the client)', async () => {
    const admin = await ready(org.adminToken);
    expect(admin.session.data).toMatchObject({ role: 'admin', scope: 'organization' });
    const manager = await ready(managerToken);
    expect(manager.session.data).toMatchObject({
      role: 'manager',
      scope: 'teams',
      teamIds: [north.teamId],
    });
    const agent = await ready(north.token);
    expect(agent.session.data).toMatchObject({ role: 'agent', scope: 'self' });
    expect(admin.session).toMatchObject({ v: 1, type: 'session:ready', id: expect.any(String) });
  });

  it('routes location updates only to authorized listeners', async () => {
    const admin = await ready(org.adminToken);
    const manager = await ready(managerToken);
    const foreign = await ready(otherOrg.adminToken);
    const southAgent = await ready(south.token);

    const adminEvents = collect(admin.socket, 'location:update');
    const managerEvents = collect(manager.socket, 'location:update');
    const foreignEvents = collect(foreign.socket, 'location:update');
    const southAgentEvents = collect(southAgent.socket, 'location:update');

    const northSession = await startShift(north.token);
    const southSession = await startShift(south.token);
    const adminGotNorth = nextEvent(admin.socket, 'location:update');
    await sendTelemetry(north.token, northSession, [sample({ seq: 1, speedMps: 6 })]).expect(200);
    await adminGotNorth;
    const adminGotSouth = nextEvent(admin.socket, 'location:update');
    await sendTelemetry(south.token, southSession, [sample({ seq: 1 })]).expect(200);
    await adminGotSouth;
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(adminEvents.map((e) => e.data.agentId).sort()).toEqual([north.id, south.id].sort());
    expect(managerEvents.map((e) => e.data.agentId)).toEqual([north.id]);
    expect(foreignEvents).toHaveLength(0);
    // Agents receive only their own updates (driver app echo), never colleagues'.
    expect(southAgentEvents.map((e) => e.data.agentId)).toEqual([south.id]);

    const update = managerEvents[0]!;
    expect(update).toMatchObject({ v: 1, type: 'location:update' });
    expect(update.data).toMatchObject({
      agentId: north.id,
      teamId: north.teamId,
      position: { lat: expect.any(Number), lng: expect.any(Number) },
      motion: 'moving',
      flags: [],
    });
  });

  it('broadcasts agent:status when a shift starts and ends', async () => {
    const manager = await ready(managerToken);
    const statuses = collect(manager.socket, 'agent:status');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const ended = nextEvent(manager.socket, 'agent:status');
    await as(north.token).post('/api/v1/shifts/end').expect(200);
    const event = await ended;
    expect(event.data).toMatchObject({
      agentId: north.id,
      shiftStatus: 'off_shift',
      connectivity: 'offline',
    });
    expect(statuses.every((s) => s.data.agentId === north.id)).toBe(true);
  });

  it('pushes geofence and visit events to the team manager', async () => {
    await as(org.adminToken)
      .post('/api/v1/locations')
      .send({
        name: 'Instant Site',
        position: { lat: 12.9756, lng: 77.6063 },
        visitRules: { minDwellSec: 0 },
      })
      .expect(201);
    const manager = await ready(managerToken);
    const entered = nextEvent(manager.socket, 'geofence:entered');
    const visit = nextEvent(manager.socket, 'visit:updated');
    const sessionId = await startShift(north.token);
    await sendTelemetry(north.token, sessionId, [sample({ seq: 9001 })]).expect(200);
    expect((await entered).data).toMatchObject({
      agentId: north.id,
      locationName: 'Instant Site',
      type: 'entered',
    });
    expect((await visit).data).toMatchObject({
      agentId: north.id,
      status: 'in_progress',
      isOpen: true,
    });
  });

  it('disconnects sockets of deactivated users at the next handshake', async () => {
    const extra = await createAgent(org.adminToken, null);
    const token = await activate(extra.email);
    await as(org.adminToken).post(`/api/v1/agents/${extra.id}/deactivate`).expect(200);
    const socket = connect(token);
    const error = await new Promise<Error & { data?: { code: string } }>((resolve) =>
      socket.once('connect_error', resolve),
    );
    expect(error.data?.code).toBe('UNAUTHENTICATED');
  });
});
