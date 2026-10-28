import { beforeAll, describe, expect, it } from 'vitest';
import { DailyAgentStats, RollupRun } from '../../src/modules/analytics/daily-stats.model.js';
import { sweepAgentAnomalies } from '../../src/modules/anomalies/anomaly.service.js';
import { LocationTelemetry } from '../../src/modules/tracking/telemetry.model.js';
import { Visit } from '../../src/modules/visits/visit.model.js';
import { toObjectId } from '../../src/shared/schemas.js';
import { addDays } from '../../src/shared/time.js';
import {
  activate,
  api,
  as,
  createAgent,
  createLocation,
  createManager,
  createTeam,
  registerOrg,
  type OrgFixture,
} from '../helpers/api.js';
import { ORIGIN, sample, sendTelemetry, startShift } from '../helpers/tracking.js';

const M = 1 / 111_320; // ≈ 1 m of latitude
const north = (meters: number) => ({ lat: ORIGIN.lat + meters * M, lng: ORIGIN.lng });
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const ALL_DAY = { start: '00:00', end: '00:00', days: [1, 2, 3, 4, 5, 6, 7] };

interface AnomalyRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  agentId: string;
  occurrences: number;
  metrics: Record<string, unknown>;
  explanation: string;
  visitId: string | null;
  resolution: { note: string | null; by: { name: string } } | null;
}

describe('anomalies, analytics and reports', () => {
  let org: OrgFixture;
  let teamId: string;
  let otherTeamId: string;
  let managerToken: string;
  let otherManagerToken: string;

  async function newAgent(team = teamId) {
    const agent = await createAgent(org.adminToken, team);
    const token = await activate(agent.email);
    const sessionId = await startShift(token);
    return { ...agent, token, sessionId };
  }

  async function anomaliesOf(agentId: string, token = org.adminToken): Promise<AnomalyRow[]> {
    const res = await as(token).get(`/api/v1/anomalies?agentId=${agentId}&limit=100`).expect(200);
    return res.body.data as AnomalyRow[];
  }

  beforeAll(async () => {
    org = await registerOrg('Anomaly Org');
    // Deterministic: no off-hours anomalies unless a test asks for them.
    await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({ settings: { workingHours: ALL_DAY } })
      .expect(200);
    const manager = await createManager(org.adminToken);
    const otherManager = await createManager(org.adminToken);
    managerToken = manager.token;
    otherManagerToken = otherManager.token;
    teamId = await createTeam(org.adminToken, 'Alpha', [manager.id]);
    otherTeamId = await createTeam(org.adminToken, 'Beta', [otherManager.id]);
  });

  it('exposes the rule thresholds in organization settings and validates updates', async () => {
    const res = await as(org.adminToken).get('/api/v1/organization').expect(200);
    expect(res.body.data.settings.anomalyRules).toMatchObject({
      impossibleSpeed: { enabled: true, maxSpeedKmh: 150 },
      gpsJump: { enabled: true, minDistanceM: 1000, maxIntervalSec: 30 },
      signalGap: { enabled: true, minGapMin: 10 },
    });
    await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({ settings: { anomalyRules: { impossibleSpeed: { maxSpeedKmh: 5 } } } })
      .expect(400);
    await as(managerToken)
      .patch('/api/v1/organization')
      .send({ settings: { anomalyRules: { gpsJump: { enabled: false } } } })
      .expect(403);
  });

  it('raises a GPS jump, merges repeats, and explains it with numbers', async () => {
    const agent = await newAgent();
    await sendTelemetry(agent.token, agent.sessionId, [
      sample({ seq: 1, offsetSec: -40, ...ORIGIN }),
      sample({ seq: 2, offsetSec: -30, ...north(5000) }),
    ]).expect(200);
    await sendTelemetry(agent.token, agent.sessionId, [
      sample({ seq: 3, offsetSec: -20, ...ORIGIN }),
    ]).expect(200);

    const rows = await anomaliesOf(agent.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'gps_jump', severity: 'medium', status: 'open' });
    expect(rows[0]!.occurrences).toBe(2);
    expect(rows[0]!.metrics.distanceM).toBeGreaterThan(4900);
    expect(rows[0]!.explanation).toContain('km');
  });

  it('raises impossible speed and mock location', async () => {
    const agent = await newAgent();
    await sendTelemetry(agent.token, agent.sessionId, [
      sample({ seq: 1, offsetSec: -40, ...ORIGIN }),
      sample({ seq: 2, offsetSec: -25, ...north(900) }), // ≈ 212 km/h
      sample({ seq: 3, offsetSec: -20, ...north(905), isMock: true }),
    ]).expect(200);
    const types = (await anomaliesOf(agent.id)).map((a) => a.type).sort();
    expect(types).toEqual(['impossible_speed', 'mock_location']);
  });

  it('keeps anomalies away from agents and outside managers', async () => {
    const agent = await newAgent();
    await sendTelemetry(agent.token, agent.sessionId, [sample({ seq: 1, isMock: true })]).expect(
      200,
    );
    await as(agent.token).get('/api/v1/anomalies').expect(403);
    expect(await anomaliesOf(agent.id, managerToken)).toHaveLength(1);
    expect(await anomaliesOf(agent.id, otherManagerToken)).toHaveLength(0);
    const [row] = await anomaliesOf(agent.id);
    await as(otherManagerToken).get(`/api/v1/anomalies/${row!.id}`).expect(404);
    await as(otherManagerToken)
      .post(`/api/v1/anomalies/${row!.id}/status`)
      .send({ status: 'dismissed' })
      .expect(404);
    const other = await registerOrg('Foreign Org');
    await as(other.adminToken).get(`/api/v1/anomalies/${row!.id}`).expect(404);
  });

  it('runs the review workflow (audited); a repeat after resolving opens a new record', async () => {
    const agent = await newAgent();
    await sendTelemetry(agent.token, agent.sessionId, [sample({ seq: 1, isMock: true })]).expect(
      200,
    );
    const [row] = await anomaliesOf(agent.id);
    const base = `/api/v1/anomalies/${row!.id}/status`;

    await as(managerToken).post(base).send({ status: 'acknowledged' }).expect(200);
    await as(managerToken).post(base).send({ status: 'acknowledged' }).expect(409);
    await as(managerToken).post(base).send({ status: 'resolved' }).expect(400);
    const resolved = await as(managerToken)
      .post(base)
      .send({ status: 'resolved', note: 'Phone had a GPS test app; removed.' })
      .expect(200);
    expect(resolved.body.data).toMatchObject({
      status: 'resolved',
      acknowledged: { by: { name: 'Team Manager' } },
      resolution: { status: 'resolved', note: 'Phone had a GPS test app; removed.' },
    });
    await as(managerToken).post(base).send({ status: 'dismissed' }).expect(409);

    const audit = await as(org.adminToken)
      .get('/api/v1/audit-logs?action=anomaly.resolved')
      .expect(200);
    const entries = audit.body.data as { entityId: string }[];
    expect(entries.some((e) => e.entityId === row!.id)).toBe(true);

    await sendTelemetry(agent.token, agent.sessionId, [sample({ seq: 2, isMock: true })]).expect(
      200,
    );
    const after = await anomaliesOf(agent.id);
    expect(after.map((a) => a.status).sort()).toEqual(['open', 'resolved']);

    const stats = await as(managerToken).get('/api/v1/anomalies/stats').expect(200);
    expect(stats.body.data.byStatus.resolved).toBeGreaterThanOrEqual(1);
    expect(stats.body.data.activeByType.mock_location).toBeGreaterThanOrEqual(1);
  });

  it('honours disabled rules', async () => {
    await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({
        settings: {
          anomalyRules: { gpsJump: { enabled: false }, impossibleSpeed: { enabled: false } },
        },
      })
      .expect(200);
    try {
      const agent = await newAgent();
      await sendTelemetry(agent.token, agent.sessionId, [
        sample({ seq: 1, offsetSec: -40, ...ORIGIN }),
        sample({ seq: 2, offsetSec: -30, ...north(5000) }),
      ]).expect(200);
      expect(await anomaliesOf(agent.id)).toEqual([]);
    } finally {
      await as(org.adminToken)
        .patch('/api/v1/organization')
        .send({
          settings: {
            anomalyRules: { gpsJump: { enabled: true }, impossibleSpeed: { enabled: true } },
          },
        })
        .expect(200);
    }
  });

  it('detects signal gaps and long stops away from client sites (sweep)', async () => {
    const agent = await newAgent();
    await sendTelemetry(agent.token, agent.sessionId, [
      sample({ seq: 1, offsetSec: -20, ...north(20_000) }),
      sample({ seq: 2, offsetSec: -10, ...north(20_001) }),
    ]).expect(200);
    const lastSeen = Date.now() - 10_000;
    const sweep = (minutes: number) =>
      sweepAgentAnomalies(
        org.orgId,
        [{ agentId: agent.id, teamId, shiftStatus: 'on_shift', lastSeen }],
        Date.now() + minutes * 60_000,
      );
    await sweep(5);
    expect(await anomaliesOf(agent.id)).toEqual([]);

    await sweep(25);
    await sweep(26); // same condition: updated, not duplicated
    const rows = await anomaliesOf(agent.id);
    expect(rows.map((a) => a.type).sort()).toEqual(['long_unplanned_stop', 'signal_gap']);
    expect(rows.every((a) => a.occurrences === 1)).toBe(true);
    const gap = rows.find((a) => a.type === 'signal_gap')!;
    expect(gap.metrics.gapMin).toBeGreaterThanOrEqual(26);

    // On break: nothing new.
    const onBreak = await newAgent();
    await sendTelemetry(onBreak.token, onBreak.sessionId, [sample({ seq: 1 })]).expect(200);
    await sweepAgentAnomalies(
      org.orgId,
      [{ agentId: onBreak.id, teamId, shiftStatus: 'on_break', lastSeen }],
      Date.now() + 60 * 60_000,
    );
    expect(await anomaliesOf(onBreak.id)).toEqual([]);
  });

  it('turns a visit needing review into an anomaly, settled by the visit review', async () => {
    const locationId = await createLocation(org.adminToken, {
      name: 'Review Site',
      position: north(-30_000),
    });
    const agent = await newAgent();
    const visit = await as(agent.token)
      .post('/api/v1/visits/check-in')
      .send({ locationId, position: ORIGIN, accuracyM: 10 })
      .expect(200);
    await as(agent.token)
      .post(`/api/v1/visits/${visit.body.data.id}/check-out`)
      .send({ position: ORIGIN, accuracyM: 10 })
      .expect(200);

    const [issue] = await anomaliesOf(agent.id);
    expect(issue).toMatchObject({
      type: 'visit_issue',
      status: 'open',
      visitId: visit.body.data.id,
      severity: 'medium',
    });
    expect(issue!.explanation).toContain('checkin outside geofence');

    await as(managerToken)
      .post(`/api/v1/visits/${visit.body.data.id}/review`)
      .send({ decision: 'verified', note: 'Called the client' })
      .expect(200);
    const [settled] = await anomaliesOf(agent.id);
    expect(settled).toMatchObject({
      status: 'resolved',
      resolution: { note: 'Visit verified by reviewer' },
    });
  });

  it('flags tracking outside working hours once per day', async () => {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date()),
    );
    const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
    await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({
        settings: {
          workingHours: { start: pad(hour + 2), end: pad(hour + 3), days: ALL_DAY.days },
        },
      })
      .expect(200);
    try {
      const agent = await newAgent();
      await sendTelemetry(agent.token, agent.sessionId, [
        sample({ seq: 1, offsetSec: -20 }),
      ]).expect(200);
      await sendTelemetry(agent.token, agent.sessionId, [
        sample({ seq: 2, offsetSec: -10 }),
      ]).expect(200);
      const rows = await anomaliesOf(agent.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: 'off_hours_activity',
        severity: 'low',
        occurrences: 1,
      });
    } finally {
      await as(org.adminToken)
        .patch('/api/v1/organization')
        .send({ settings: { workingHours: ALL_DAY } })
        .expect(200);
    }
  });

  describe('analytics', () => {
    let reportOrg: OrgFixture;
    let alphaTeam: string;
    let betaTeam: string;
    let alphaManager: string;
    let agentId: string;

    beforeAll(async () => {
      reportOrg = await registerOrg('Report Org');
      await as(reportOrg.adminToken)
        .patch('/api/v1/organization')
        .send({ settings: { workingHours: ALL_DAY } })
        .expect(200);
      const manager = await createManager(reportOrg.adminToken);
      alphaManager = manager.token;
      alphaTeam = await createTeam(reportOrg.adminToken, 'Alpha', [manager.id]);
      betaTeam = await createTeam(reportOrg.adminToken, 'Beta');

      const agent = await createAgent(reportOrg.adminToken, alphaTeam);
      agentId = agent.id;
      const token = await activate(agent.email);
      const sessionId = await startShift(token);
      // ~1 km driven today plus a mock fix (one anomaly).
      await sendTelemetry(token, sessionId, [
        sample({ seq: 1, offsetSec: -60, ...ORIGIN }),
        sample({ seq: 2, offsetSec: -30, ...north(500) }),
        sample({ seq: 3, offsetSec: -1, ...north(1000), isMock: true }),
      ]).expect(200);

      // Yesterday: telemetry + a verified and a missed visit, inserted directly.
      const yesterday = addDays(today(), -1);
      const noonYesterday = new Date(`${yesterday}T06:30:00.000Z`); // 12:00 IST
      const orgId = toObjectId(reportOrg.orgId);
      const meta = { orgId, agentId: toObjectId(agentId), sessionId: toObjectId(sessionId) };
      await LocationTelemetry.insertMany(
        [0, 2000].map((m, i) => ({
          recordedAt: new Date(noonYesterday.getTime() + i * 120_000),
          receivedAt: new Date(),
          meta,
          seq: 1000 + i,
          ...north(m),
          accuracyM: 10,
          flags: [],
        })),
      );
      const locationId = await createLocation(reportOrg.adminToken, { name: 'Yesterday Site' });
      const visitBase = {
        orgId,
        agentId: toObjectId(agentId),
        teamId: toObjectId(alphaTeam),
        locationId: toObjectId(locationId),
        isOpen: false,
        visitDate: yesterday,
      };
      await Visit.create([
        {
          ...visitBase,
          method: 'auto',
          status: 'verified',
          checkInAt: noonYesterday,
          checkOutAt: new Date(noonYesterday.getTime() + 600_000),
          durationSec: 600,
          signals: { sampleCount: 5, avgAccuracyM: 10, maxAccuracyM: 12, mockLocation: false },
        },
        {
          ...visitBase,
          method: 'auto',
          status: 'missed',
          signals: { sampleCount: 0, avgAccuracyM: null, maxAccuracyM: null, mockLocation: false },
        },
      ]);
    });

    it('summarises stored days and live today', async () => {
      const from = addDays(today(), -1);
      const res = await as(reportOrg.adminToken)
        .get(`/api/v1/analytics/summary?from=${from}`)
        .expect(200);
      const s = res.body.data;
      expect(s).toMatchObject({ from, to: today(), teamId: null, agentsActive: 1 });
      expect(s.distanceKm).toBeGreaterThanOrEqual(2.9);
      expect(s.distanceKm).toBeLessThanOrEqual(3.1);
      expect(s.visits).toMatchObject({ total: 2, verified: 1, missed: 1 });
      expect(s.verificationRate).toBe(1);
      expect(s.avgDwellMin).toBe(10);
      expect(s.anomalies.byType.mock_location).toBe(1);

      // Yesterday was rolled up and stored; today was not.
      expect(await RollupRun.exists({ orgId: reportOrg.orgId, day: from })).toBeTruthy();
      const stored = await DailyAgentStats.find({ orgId: reportOrg.orgId }).lean();
      expect(stored.map((r) => r.day)).toEqual([from]);
      expect(stored[0]!.visits.missed).toBe(1);
    });

    it('returns a daily trend and per-agent scorecards', async () => {
      const daily = await as(reportOrg.adminToken).get('/api/v1/analytics/daily').expect(200);
      expect(daily.body.data).toHaveLength(7);
      const days = daily.body.data as { day: string; anomalies: number }[];
      expect(days.at(-1)).toMatchObject({ day: today(), anomalies: 1 });

      const agents = await as(reportOrg.adminToken)
        .get(`/api/v1/analytics/agents?from=${addDays(today(), -1)}`)
        .expect(200);
      expect(agents.body.data).toHaveLength(1);
      expect(agents.body.data[0]).toMatchObject({
        agentId,
        name: 'Field Agent',
        teamId: alphaTeam,
        daysActive: 2,
        anomalies: 1,
        highAnomalies: 1,
      });
    });

    it('scopes analytics to the manager’s teams and validates ranges', async () => {
      const mine = await as(alphaManager).get('/api/v1/analytics/summary').expect(200);
      expect(mine.body.data.agentsActive).toBe(1);
      await as(alphaManager).get(`/api/v1/analytics/summary?teamId=${betaTeam}`).expect(404);
      const beta = await as(reportOrg.adminToken)
        .get(`/api/v1/analytics/summary?teamId=${betaTeam}`)
        .expect(200);
      expect(beta.body.data.agentsActive).toBe(0);
      await as(reportOrg.adminToken)
        .get(`/api/v1/analytics/summary?from=2026-01-01&to=2026-12-31`)
        .expect(400);
      await as(reportOrg.adminToken)
        .get(`/api/v1/analytics/summary?from=2026-02-02&to=2026-02-01`)
        .expect(400);
    });

    it('streams CSV reports and audits each export', async () => {
      const from = addDays(today(), -1);
      const visits = await as(reportOrg.adminToken)
        .get(`/api/v1/reports/visits?from=${from}`)
        .expect(200);
      expect(visits.headers['content-type']).toContain('text/csv');
      expect(visits.headers['content-disposition']).toContain(`fieldtrace-visits-${from}`);
      const lines = visits.text.trim().split('\r\n');
      expect(lines[0]).toMatch(/^visit_date,agent,employee_code,team,location,status/);
      expect(lines).toHaveLength(3);
      expect(
        lines.slice(1).some((l) => l.includes('Yesterday Site') && l.includes('verified')),
      ).toBe(true);

      const anomalies = await as(alphaManager).get('/api/v1/reports/anomalies').expect(200);
      expect(anomalies.text).toContain('mock_location');

      const daily = await as(reportOrg.adminToken)
        .get(`/api/v1/reports/agent-daily?from=${from}`)
        .expect(200);
      expect(daily.text.trim().split('\r\n')).toHaveLength(3);

      await as(reportOrg.adminToken).get('/api/v1/reports/payroll').expect(400);
      const audit = await as(reportOrg.adminToken)
        .get('/api/v1/audit-logs?action=report.exported')
        .expect(200);
      expect(audit.body.data.length).toBeGreaterThanOrEqual(3);
      expect(audit.body.data[0].metadata).toHaveProperty('rows');
    });

    it('refuses analytics and reports to agents and anonymous callers', async () => {
      await api.get('/api/v1/analytics/summary').expect(401);
      await api.get('/api/v1/reports/visits').expect(401);
      const agent = await createAgent(reportOrg.adminToken, betaTeam);
      const token = await activate(agent.email);
      await as(token).get('/api/v1/analytics/summary').expect(403);
      await as(token).get('/api/v1/reports/visits').expect(403);
    });
  });

  it('lists anomalies with filters', async () => {
    const res = await as(org.adminToken)
      .get('/api/v1/anomalies?type=mock_location&status=open,acknowledged&sort=firstSeenAt')
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const rows = res.body.data as AnomalyRow[];
    expect(rows.every((a) => a.type === 'mock_location')).toBe(true);
    await as(org.adminToken).get('/api/v1/anomalies?type=bogus').expect(400);
    await as(org.adminToken).get(`/api/v1/anomalies?teamId=${otherTeamId}`).expect(200);
  });
});
