import { beforeAll, describe, expect, it } from 'vitest';
import { getConnectivityStates } from '../../src/modules/tracking/live-state.js';
import { runStatusSweep } from '../../src/modules/tracking/status-sweeper.js';
import { TrackingSession } from '../../src/modules/tracking/tracking-session.model.js';
import {
  activate,
  as,
  createAgent,
  createManager,
  createTeam,
  registerOrg,
  type OrgFixture,
} from '../helpers/api.js';
import { ORIGIN, sample, sendTelemetry, startShift } from '../helpers/tracking.js';

describe('shifts', () => {
  let org: OrgFixture;
  let agentToken: string;

  beforeAll(async () => {
    org = await registerOrg('Shift Org');
    const agent = await createAgent(org.adminToken, null);
    agentToken = await activate(agent.email);
  });

  it('start is idempotent, break toggles, end closes the session', async () => {
    expect((await as(agentToken).get('/api/v1/shifts/current')).body.data.session).toBeNull();

    const first = await as(agentToken)
      .post('/api/v1/shifts/start')
      .send({ device: { platform: 'android', appVersion: '1.0.0' } });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      isActive: true,
      shiftStatus: 'on_shift',
      device: { platform: 'android', appVersion: '1.0.0' },
    });

    const again = await as(agentToken).post('/api/v1/shifts/start').send({});
    expect(again.body.data.id).toBe(first.body.data.id);

    const current = await as(agentToken).get('/api/v1/shifts/current');
    expect(current.body.data.session.id).toBe(first.body.data.id);

    const onBreak = await as(agentToken).post('/api/v1/shifts/break').send({ onBreak: true });
    expect(onBreak.body.data.shiftStatus).toBe('on_break');
    const me = await as(agentToken).get('/api/v1/agents/me');
    expect(me.body.data.shiftStatus).toBe('on_break');

    const ended = await as(agentToken).post('/api/v1/shifts/end');
    expect(ended.body.data).toMatchObject({ isActive: false, shiftStatus: 'off_shift' });
    expect(ended.body.data.endedAt).toEqual(expect.any(String));

    const endAgain = await as(agentToken).post('/api/v1/shifts/end');
    expect(endAgain.status).toBe(409);
    expect(endAgain.body.error.code).toBe('SHIFT_NOT_ACTIVE');
    expect(
      (await as(agentToken).post('/api/v1/shifts/break').send({ onBreak: false })).status,
    ).toBe(409);
  });

  it('the database allows only one active session per agent', async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => as(agentToken).post('/api/v1/shifts/start').send({})),
    );
    const ids = new Set(results.map((r) => r.body.data.id as string));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(ids.size).toBe(1);
  });

  it('staff cannot use driver shift endpoints', async () => {
    expect((await as(org.adminToken).post('/api/v1/shifts/start').send({})).status).toBe(403);
  });
});

describe('telemetry ingestion', () => {
  let org: OrgFixture;
  let agentId: string;
  let agentToken: string;
  let sessionId: string;
  let otherAgentToken: string;

  beforeAll(async () => {
    org = await registerOrg('Telemetry Org');
    const agent = await createAgent(org.adminToken, null);
    agentId = agent.id;
    agentToken = await activate(agent.email);
    const other = await createAgent(org.adminToken, null);
    otherAgentToken = await activate(other.email);
  });

  it('rejects uploads without an active shift', async () => {
    const res = await sendTelemetry(agentToken, '6704f1c2a1b2c3d4e5f60718', [sample({ seq: 1 })]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SHIFT_NOT_ACTIVE');
  });

  it('accepts a valid batch and updates the live position', async () => {
    sessionId = await startShift(agentToken);
    const res = await sendTelemetry(agentToken, sessionId, [
      sample({ seq: 1, offsetSec: -20, speedMps: 8, batteryPct: 81 }),
      sample({
        seq: 2,
        offsetSec: -10,
        lat: ORIGIN.lat + 0.001,
        speedMps: 9,
        batteryPct: 80,
        headingDeg: 10,
      }),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ accepted: 2, duplicates: 0, rejected: [] });
    expect(res.body.data.serverTime).toEqual(expect.any(String));

    const live = await as(org.adminToken).get('/api/v1/fleet/live');
    const entry = (live.body.data.agents as { agentId: string }[]).find(
      (a) => a.agentId === agentId,
    );
    expect(entry).toMatchObject({
      shiftStatus: 'on_shift',
      connectivity: 'online',
      motion: 'moving',
      position: { lat: ORIGIN.lat + 0.001, lng: ORIGIN.lng },
      batteryPct: 80,
      headingDeg: 10,
    });

    const profile = await as(org.adminToken).get(`/api/v1/agents/${agentId}`);
    expect(profile.body.data.lastLocation.position).toEqual({
      lat: ORIGIN.lat + 0.001,
      lng: ORIGIN.lng,
    });
    expect(profile.body.data.lastSeenAt).toEqual(expect.any(String));
  });

  it('is idempotent: re-sending the same seqs reports duplicates, stores nothing twice', async () => {
    const batch = [sample({ seq: 1, offsetSec: -20 }), sample({ seq: 3, offsetSec: -4 })];
    const res = await sendTelemetry(agentToken, sessionId, batch);
    expect(res.body.data).toMatchObject({ accepted: 1, duplicates: 1 });
    const retry = await sendTelemetry(agentToken, sessionId, batch);
    expect(retry.body.data).toMatchObject({ accepted: 0, duplicates: 2 });

    const track = await as(org.adminToken).get(`/api/v1/agents/${agentId}/track`);
    expect(track.body.data.pointCount).toBe(3);
  });

  it('rejects bad timestamps and in-batch duplicates with reasons', async () => {
    const res = await sendTelemetry(agentToken, sessionId, [
      sample({ seq: 10, offsetSec: 600 }),
      sample({ seq: 11, offsetSec: -2 * 86_400 }),
      sample({ seq: 12, offsetSec: -3600 }),
      sample({ seq: 13, offsetSec: -3 }),
      sample({ seq: 13, offsetSec: -2 }),
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(1);
    expect(res.body.data.rejected).toEqual([
      { seq: 10, reason: 'future_timestamp' },
      { seq: 11, reason: 'too_old' },
      { seq: 12, reason: 'before_shift' },
      { seq: 13, reason: 'duplicate_in_batch' },
    ]);
  });

  it('flags low accuracy and mock locations instead of dropping them', async () => {
    await sendTelemetry(agentToken, sessionId, [
      sample({ seq: 20, accuracyM: 350, isMock: true, offsetSec: -1 }),
    ]);
    const track = await as(org.adminToken).get(`/api/v1/agents/${agentId}/track`);
    const last = (track.body.data.points as { flags: string[] }[]).at(-1)!;
    expect(last.flags).toEqual(['low_accuracy', 'mock_location']);
  });

  it('never moves the live marker backwards for late (older) uploads', async () => {
    const before = await as(org.adminToken).get('/api/v1/fleet/live');
    const pos = (before.body.data.agents as { agentId: string; recordedAt: string }[]).find(
      (a) => a.agentId === agentId,
    )!;
    await sendTelemetry(agentToken, sessionId, [sample({ seq: 30, offsetSec: -60, lat: 13.5 })]);
    const after = await as(org.adminToken).get('/api/v1/fleet/live');
    const now = (
      after.body.data.agents as { agentId: string; recordedAt: string; position: { lat: number } }[]
    ).find((a) => a.agentId === agentId)!;
    expect(now.recordedAt).toBe(pos.recordedAt);
    expect(now.position.lat).not.toBe(13.5);
  });

  it('validates payloads strictly', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => sample({ seq: 100 + i }));
    expect((await sendTelemetry(agentToken, sessionId, tooMany)).status).toBe(400);
    expect(
      (await sendTelemetry(agentToken, sessionId, [{ ...sample({ seq: 200 }), lat: 95 }])).status,
    ).toBe(400);
    expect(
      (await sendTelemetry(agentToken, sessionId, [{ ...sample({ seq: 201 }), extra: 1 }])).status,
    ).toBe(400);
    expect((await sendTelemetry(agentToken, sessionId, [])).status).toBe(400);
  });

  it("an agent cannot upload into another agent's session", async () => {
    const res = await sendTelemetry(otherAgentToken, sessionId, [sample({ seq: 1 })]);
    expect(res.status).toBe(409);
  });

  it('staff cannot upload telemetry', async () => {
    expect((await sendTelemetry(org.adminToken, sessionId, [sample({ seq: 1 })])).status).toBe(403);
  });

  it('deactivating the agent ends the shift and removes them from the live map', async () => {
    const extra = await createAgent(org.adminToken, null);
    const token = await activate(extra.email);
    const sid = await startShift(token);
    await as(org.adminToken).post(`/api/v1/agents/${extra.id}/deactivate`).expect(200);
    const session = await TrackingSession.findOne({ orgId: org.orgId, _id: sid }).lean();
    expect(session).toMatchObject({ isActive: false, endReason: 'agent_deactivated' });
    const live = await as(org.adminToken).get('/api/v1/fleet/live');
    expect((live.body.data.agents as { agentId: string }[]).map((a) => a.agentId)).not.toContain(
      extra.id,
    );
  });

  it('the status sweep marks silent agents stale, then offline (and is change-only)', async () => {
    const state = async () => (await getConnectivityStates(org.orgId, [agentId]))[0];
    await runStatusSweep(Date.now() + 2 * 60_000);
    expect(await state()).toBe('stale');
    expect(await runStatusSweep(Date.now() + 10 * 60_000)).toBeGreaterThanOrEqual(1);
    expect(await state()).toBe('offline');
    expect(await runStatusSweep(Date.now() + 10 * 60_000)).toBe(0);
  });
});

describe('fleet scope & track history', () => {
  let org: OrgFixture;
  let managerToken: string;
  let northAgent: { id: string; token: string };
  let southAgent: { id: string; token: string };

  beforeAll(async () => {
    org = await registerOrg('Fleet Org');
    const manager = await createManager(org.adminToken);
    managerToken = manager.token;
    const north = await createTeam(org.adminToken, 'North', [manager.id]);
    const south = await createTeam(org.adminToken, 'South');
    const n = await createAgent(org.adminToken, north);
    const s = await createAgent(org.adminToken, south);
    northAgent = { id: n.id, token: await activate(n.email) };
    southAgent = { id: s.id, token: await activate(s.email) };

    const sid = await startShift(northAgent.token);
    // ~111 m north per 0.001° latitude, 10 points one second apart.
    await sendTelemetry(
      northAgent.token,
      sid,
      Array.from({ length: 10 }, (_, i) =>
        sample({ seq: i, offsetSec: -20 + i, lat: ORIGIN.lat + i * 0.001 }),
      ),
    );
  });

  it('managers see only agents of their teams on the live map', async () => {
    const res = await as(managerToken).get('/api/v1/fleet/live');
    expect((res.body.data.agents as { agentId: string }[]).map((a) => a.agentId)).toEqual([
      northAgent.id,
    ]);
    const admin = await as(org.adminToken).get('/api/v1/fleet/live');
    expect(admin.body.data.agents).toHaveLength(2);
    const offline = (
      admin.body.data.agents as { agentId: string; connectivity: string; position: unknown }[]
    ).find((a) => a.agentId === southAgent.id)!;
    expect(offline).toMatchObject({ connectivity: 'offline', position: null });
  });

  it('agents cannot read the live fleet', async () => {
    expect((await as(northAgent.token).get('/api/v1/fleet/live')).status).toBe(403);
  });

  it('returns ordered points with distance and pagination', async () => {
    const res = await as(managerToken).get(`/api/v1/agents/${northAgent.id}/track`);
    expect(res.status).toBe(200);
    const times = (res.body.data.points as { recordedAt: string }[]).map((p) => p.recordedAt);
    expect([...times].sort()).toEqual(times);
    expect(res.body.data.pointCount).toBe(10);
    expect(res.body.data.distanceM).toBeGreaterThan(950);
    expect(res.body.data.distanceM).toBeLessThan(1050);

    const page = await as(managerToken).get(`/api/v1/agents/${northAgent.id}/track?limit=4`);
    expect(page.body.data).toMatchObject({ pointCount: 4, truncated: true });
    const next = await as(managerToken).get(
      `/api/v1/agents/${northAgent.id}/track?limit=100&from=${encodeURIComponent(page.body.data.nextFrom as string)}`,
    );
    expect(next.body.data.pointCount).toBe(6);
  });

  it('enforces track scope and window limits', async () => {
    expect((await as(managerToken).get(`/api/v1/agents/${southAgent.id}/track`)).status).toBe(404);
    expect((await as(northAgent.token).get(`/api/v1/agents/${northAgent.id}/track`)).status).toBe(
      200,
    );
    expect((await as(northAgent.token).get(`/api/v1/agents/${southAgent.id}/track`)).status).toBe(
      404,
    );

    const from = new Date(Date.now() - 30 * 3_600_000).toISOString();
    const wide = await as(org.adminToken).get(
      `/api/v1/agents/${northAgent.id}/track?from=${encodeURIComponent(from)}`,
    );
    expect(wide.status).toBe(400);
  });

  it('other organizations cannot see the track or the fleet', async () => {
    const other = await registerOrg('Other Fleet Org');
    expect((await as(other.adminToken).get(`/api/v1/agents/${northAgent.id}/track`)).status).toBe(
      404,
    );
    const live = await as(other.adminToken).get('/api/v1/fleet/live');
    expect(live.body.data.agents).toEqual([]);
  });
});
