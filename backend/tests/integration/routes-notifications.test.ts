import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runRetention } from '../../src/modules/maintenance/retention.js';
import {
  Notification,
  WebhookDelivery,
} from '../../src/modules/notifications/notification.model.js';
import { runDispatch } from '../../src/modules/notifications/notification.service.js';
import { LocationTelemetry } from '../../src/modules/tracking/telemetry.model.js';
import { runAssignmentSweep } from '../../src/modules/visits/sweepers.js';
import { toObjectId } from '../../src/shared/schemas.js';
import {
  activate,
  as,
  createAgent,
  createLocation,
  createManager,
  createTeam,
  registerOrg,
  type OrgFixture,
} from '../helpers/api.js';
import { ORIGIN, sample, sendTelemetry, startShift } from '../helpers/tracking.js';

const M = 1 / 111_320;
const north = (km: number) => ({ lat: ORIGIN.lat + km * 1000 * M, lng: ORIGIN.lng });
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const ALL_DAY = { start: '00:00', end: '00:00', days: [1, 2, 3, 4, 5, 6, 7] };

interface NotificationRow {
  id: string;
  kind: string;
  severity: string;
  title: string;
  readAt: string | null;
  emailStatus: string;
}
interface StopRow {
  sequence: number;
  title: string | null;
  locationName: string;
  assignmentId: string;
  eta: string;
}
interface Received {
  headers: IncomingMessage['headers'];
  body: string;
}

describe('route optimization, notifications and retention', () => {
  let org: OrgFixture;
  let alphaTeam: string;
  let betaTeam: string;
  let managerA: { id: string; token: string };
  let managerB: { id: string; token: string };

  async function newAgent(team: string) {
    const agent = await createAgent(org.adminToken, team);
    const token = await activate(agent.email);
    return { ...agent, token };
  }

  async function inbox(token: string): Promise<NotificationRow[]> {
    const res = await as(token).get('/api/v1/notifications?limit=100').expect(200);
    return res.body.data as NotificationRow[];
  }

  beforeAll(async () => {
    org = await registerOrg('Routing Org');
    await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({ settings: { workingHours: ALL_DAY } })
      .expect(200);
    managerA = await createManager(org.adminToken);
    managerB = await createManager(org.adminToken);
    alphaTeam = await createTeam(org.adminToken, 'Alpha', [managerA.id]);
    betaTeam = await createTeam(org.adminToken, 'Beta', [managerB.id]);
  });

  describe('routes', () => {
    let agent: Awaited<ReturnType<typeof newAgent>>;
    const assignmentIds: Record<string, string> = {};

    beforeAll(async () => {
      agent = await newAgent(alphaTeam);
      for (const km of [6, 1, 3]) {
        const locationId = await createLocation(org.adminToken, {
          name: `Site ${km} km`,
          position: north(km),
        });
        const res = await as(org.adminToken)
          .post('/api/v1/assignments')
          .send({ agentId: agent.id, locationId, scheduledDate: today(), title: `Stop ${km}` })
          .expect(201);
        assignmentIds[`${km}`] = res.body.data.id as string;
      }
    });

    it('previews an optimized order with ETAs, baseline and honest warnings', async () => {
      const res = await as(managerA.token)
        .post('/api/v1/routes/optimize')
        .send({ agentId: agent.id, start: { type: 'position', position: ORIGIN }, serviceMin: 5 })
        .expect(200);
      const plan = res.body.data;
      expect(plan.id).toBeNull();
      expect(plan.provider).toBe('builtin');
      expect((plan.stops as StopRow[]).map((s) => s.locationName)).toEqual([
        'Site 1 km',
        'Site 3 km',
        'Site 6 km',
      ]);
      expect(plan.totals.distanceM).toBeGreaterThan(7500); // 6 km × road factor 1.3
      expect(plan.totals.distanceM).toBeLessThan(8100);
      expect(plan.baseline.distanceM).toBeGreaterThan(plan.totals.distanceM);
      expect((plan.warnings as string[]).join(' ')).toContain('straight-line');
      const etas = (plan.stops as StopRow[]).map((s) => Date.parse(s.eta));
      expect(etas[1]! - etas[0]!).toBeGreaterThanOrEqual(5 * 60_000); // service time included
    });

    it('saves the plan, links assignments, supersedes older plans and drives route analysis', async () => {
      const body = { agentId: agent.id, start: { type: 'position', position: ORIGIN } };
      const first = await as(managerA.token).post('/api/v1/routes').send(body).expect(201);
      const second = await as(org.adminToken).post('/api/v1/routes').send(body).expect(201);
      expect(second.body.data).toMatchObject({ status: 'active' });
      expect(second.body.data.id).not.toBe(first.body.data.id);

      const list = await as(managerA.token).get('/api/v1/routes').expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].id).toBe(second.body.data.id);

      const assignment = await as(org.adminToken)
        .get(`/api/v1/assignments/${assignmentIds['6']}`)
        .expect(200);
      expect(assignment.body.data.routeId).toBe(second.body.data.id);

      const mine = await as(agent.token).get('/api/v1/routes/mine').expect(200);
      expect((mine.body.data.stops as StopRow[]).map((s) => s.title)).toEqual([
        'Stop 1',
        'Stop 3',
        'Stop 6',
      ]);

      const analysis = await as(managerA.token)
        .get(`/api/v1/agents/${agent.id}/route-analysis`)
        .expect(200);
      expect(
        (analysis.body.data.plan as { locationName: string; plannedOrder: number }[]).map(
          (p) => p.locationName,
        ),
      ).toEqual(['Site 1 km', 'Site 3 km', 'Site 6 km']);

      const audit = await as(org.adminToken)
        .get('/api/v1/audit-logs?action=route.planned')
        .expect(200);
      expect(audit.body.data.length).toBe(2);
    });

    it('starts from the live GPS position when available', async () => {
      const sessionId = await startShift(agent.token);
      await sendTelemetry(agent.token, sessionId, [sample({ seq: 1, ...north(7) })]).expect(200);
      const res = await as(managerA.token)
        .post('/api/v1/routes/optimize')
        .send({ agentId: agent.id })
        .expect(200);
      expect(res.body.data.start.source).toBe('current');
      // From 7 km the best order is 6 → 3 → 1.
      expect((res.body.data.stops as StopRow[]).map((s) => s.locationName)).toEqual([
        'Site 6 km',
        'Site 3 km',
        'Site 1 km',
      ]);
    });

    it('enforces scope, roles and validation', async () => {
      const body = { agentId: agent.id };
      await as(managerB.token).post('/api/v1/routes/optimize').send(body).expect(404);
      await as(agent.token).post('/api/v1/routes/optimize').send(body).expect(403);
      const idle = await newAgent(betaTeam);
      await as(org.adminToken)
        .post('/api/v1/routes/optimize')
        .send({ agentId: idle.id })
        .expect(400);
      await as(idle.token).get('/api/v1/routes/mine').expect(404);
      await as(org.adminToken)
        .post('/api/v1/routes/optimize')
        .send({ agentId: agent.id, assignmentIds: ['0123456789abcdef01234567'] })
        .expect(400);
    });
  });

  describe('notifications', () => {
    let server: Server;
    let hookUrl: string;
    const received: Received[] = [];
    let respondWith = 200;

    beforeAll(async () => {
      server = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString()));
        req.on('end', () => {
          received.push({ headers: req.headers, body });
          res.statusCode = respondWith;
          res.end('ok');
        });
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      hookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    });
    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

    it('notifies admins and the team managers of a new anomaly, then emails it', async () => {
      const agent = await newAgent(alphaTeam);
      const sessionId = await startShift(agent.token);
      await sendTelemetry(agent.token, sessionId, [sample({ seq: 1, isMock: true })]).expect(200);

      const forA = (await inbox(managerA.token)).filter((n) => n.kind === 'anomaly');
      expect(forA).toHaveLength(1);
      expect(forA[0]).toMatchObject({ severity: 'high', readAt: null, emailStatus: 'pending' });
      expect(forA[0]!.title).toContain('Mock location');
      expect((await inbox(org.adminToken)).some((n) => n.kind === 'anomaly')).toBe(true);
      expect((await inbox(managerB.token)).filter((n) => n.kind === 'anomaly')).toHaveLength(0);
      await as(agent.token).get('/api/v1/notifications').expect(403);

      const count = await as(managerA.token).get('/api/v1/notifications/unread-count').expect(200);
      expect(count.body.data.unread).toBeGreaterThanOrEqual(1);
      const read = await as(managerA.token)
        .post(`/api/v1/notifications/${forA[0]!.id}/read`)
        .expect(200);
      expect(read.body.data.readAt).not.toBeNull();
      await as(managerB.token).post(`/api/v1/notifications/${forA[0]!.id}/read`).expect(404);

      await runDispatch();
      const after = (await inbox(managerA.token)).find((n) => n.id === forA[0]!.id)!;
      expect(after.emailStatus).toBe('logged'); // no RESEND_API_KEY in tests

      await as(managerA.token).post('/api/v1/notifications/read-all').expect(200);
      const unread = await as(managerA.token).get('/api/v1/notifications?unread=true').expect(200);
      expect(unread.body.data).toEqual([]);
    });

    it('respects preferences', async () => {
      const prefs = await as(managerA.token).get('/api/v1/notifications/preferences').expect(200);
      expect(prefs.body.data).toEqual({
        events: { anomaly: true, assignment_overdue: true },
        email: { enabled: true, minSeverity: 'high' },
      });
      await as(managerA.token)
        .patch('/api/v1/notifications/preferences')
        .send({ email: { minSeverity: 'urgent' } })
        .expect(400);
      await as(managerA.token)
        .patch('/api/v1/notifications/preferences')
        .send({ events: { anomaly: false } })
        .expect(200);

      const before = (await inbox(managerA.token)).length;
      const agent = await newAgent(alphaTeam);
      const sessionId = await startShift(agent.token);
      await sendTelemetry(agent.token, sessionId, [sample({ seq: 1, isMock: true })]).expect(200);
      expect(await inbox(managerA.token)).toHaveLength(before);

      await as(managerA.token)
        .patch('/api/v1/notifications/preferences')
        .send({ events: { anomaly: true } })
        .expect(200);
    });

    it('alerts managers when an assignment becomes overdue', async () => {
      const agent = await newAgent(alphaTeam);
      const locationId = await createLocation(org.adminToken, { name: 'Deadline Site' });
      await as(org.adminToken)
        .post('/api/v1/assignments')
        .send({
          agentId: agent.id,
          locationId,
          scheduledDate: today(),
          deadline: new Date(Date.now() + 60_000).toISOString(),
          priority: 'urgent',
          title: 'Deliver contract',
        })
        .expect(201);
      await runAssignmentSweep(new Date(Date.now() + 120_000));
      const overdue = (await inbox(managerA.token)).find((n) => n.kind === 'assignment_overdue');
      expect(overdue).toMatchObject({ severity: 'high', title: 'Overdue: Deliver contract' });
    });

    it('delivers signed webhooks with retries; secrets are shown once', async () => {
      await as(managerA.token)
        .put('/api/v1/notifications/webhook')
        .send({ url: hookUrl })
        .expect(403);
      await as(org.adminToken).get('/api/v1/notifications/webhook').expect(404);
      await as(org.adminToken)
        .put('/api/v1/notifications/webhook')
        .send({ url: 'ftp://example.com/x' })
        .expect(400);

      const created = await as(org.adminToken)
        .put('/api/v1/notifications/webhook')
        .send({ url: hookUrl, minSeverity: 'low' })
        .expect(200);
      const secret = created.body.data.secret as string;
      expect(secret).toMatch(/^whsec_/);
      const shown = await as(org.adminToken).get('/api/v1/notifications/webhook').expect(200);
      expect(shown.body.data.secret).toBeUndefined();
      expect(shown.body.data.secretHint).toBe(secret.slice(-4));

      const verify = (r: Received, key: string) => {
        const ts = r.headers['x-fieldtrace-timestamp'] as string;
        const expected = createHmac('sha256', key).update(`${ts}.${r.body}`).digest('hex');
        expect(r.headers['x-fieldtrace-signature']).toBe(`sha256=${expected}`);
      };

      const test = await as(org.adminToken).post('/api/v1/notifications/webhook/test').expect(200);
      expect(test.body.data).toMatchObject({ ok: true, status: 200 });
      verify(received.at(-1)!, secret);
      expect(received.at(-1)!.headers['x-fieldtrace-event']).toBe('webhook.test');

      // A real event goes through the outbox.
      const agent = await newAgent(alphaTeam);
      const sessionId = await startShift(agent.token);
      await sendTelemetry(agent.token, sessionId, [sample({ seq: 1, isMock: true })]).expect(200);
      await runDispatch();
      const event = received.find((r) => r.headers['x-fieldtrace-event'] === 'anomaly.created');
      expect(event).toBeDefined();
      verify(event!, secret);
      expect(JSON.parse(event!.body)).toMatchObject({
        type: 'anomaly.created',
        severity: 'high',
        data: { type: 'mock_location', agentId: agent.id },
      });

      // Receiver failing: retried with backoff, then marked failed.
      respondWith = 500;
      const test2 = await as(org.adminToken).post('/api/v1/notifications/webhook/test').expect(200);
      expect(test2.body.data).toMatchObject({ ok: false });
      const other = await newAgent(alphaTeam);
      const otherSession = await startShift(other.token);
      await sendTelemetry(other.token, otherSession, [sample({ seq: 1, isMock: true })]).expect(
        200,
      );
      let now = Date.now();
      for (let i = 0; i < 6; i++) {
        await runDispatch(new Date(now));
        now += 61 * 60_000;
      }
      const failed = await WebhookDelivery.findOne({
        orgId: org.orgId,
        'delivery.status': 'failed',
      }).lean();
      expect(failed?.delivery.attempts).toBe(5);
      const deliveries = await as(org.adminToken)
        .get('/api/v1/notifications/webhook/deliveries')
        .expect(200);
      const statuses = (deliveries.body.data as { status: string }[]).map((d) => d.status);
      expect(statuses).toEqual(expect.arrayContaining(['sent', 'failed']));
      respondWith = 200;

      const rotated = await as(org.adminToken)
        .post('/api/v1/notifications/webhook/rotate-secret')
        .expect(200);
      expect(rotated.body.data.secret).not.toBe(secret);
      await as(org.adminToken).delete('/api/v1/notifications/webhook').expect(204);
      await as(org.adminToken).delete('/api/v1/notifications/webhook').expect(404);
    });
  });

  it('enforces per-organization telemetry retention and notification retention', async () => {
    await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({ settings: { telemetryRetentionDays: 30 } })
      .expect(200);
    const agent = await newAgent(alphaTeam);
    const sessionId = await startShift(agent.token);
    const meta = {
      orgId: toObjectId(org.orgId),
      agentId: toObjectId(agent.id),
      sessionId: toObjectId(sessionId),
    };
    const day = 86_400_000;
    await LocationTelemetry.insertMany(
      [40, 5].map((daysAgo, i) => ({
        recordedAt: new Date(Date.now() - daysAgo * day),
        receivedAt: new Date(),
        meta,
        seq: 5000 + i,
        ...ORIGIN,
        accuracyM: 10,
        flags: [],
      })),
    );
    await Notification.collection.insertOne({
      orgId: toObjectId(org.orgId),
      userId: toObjectId(org.adminId),
      kind: 'test',
      severity: 'low',
      title: 'old',
      body: 'old',
      link: null,
      entityType: null,
      entityId: null,
      readAt: null,
      email: { status: 'skipped', attempts: 0, nextAttemptAt: null, lastError: null, sentAt: null },
      createdAt: new Date(Date.now() - 120 * day),
      updatedAt: new Date(Date.now() - 120 * day),
    });

    const result = await runRetention();
    expect(result.telemetry).toBeGreaterThanOrEqual(1);
    expect(result.notifications).toBeGreaterThanOrEqual(1);
    const left = await LocationTelemetry.find({
      'meta.orgId': meta.orgId,
      'meta.agentId': meta.agentId,
    }).lean();
    expect(left.map((d) => d.seq)).toEqual([5001]);
  });
});
