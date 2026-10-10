import { beforeAll, describe, expect, it } from 'vitest';
import { getPresence } from '../../src/modules/visits/presence.js';
import { runAssignmentSweep, sweepStalePresences } from '../../src/modules/visits/sweepers.js';
import { Assignment } from '../../src/modules/assignments/assignment.model.js';
import { LocationTelemetry } from '../../src/modules/tracking/telemetry.model.js';
import { toObjectId } from '../../src/shared/schemas.js';
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

const M = 1 / 111_320; // ≈ 1 m of latitude
const INSIDE = ORIGIN;
const OUTSIDE = { lat: ORIGIN.lat + 500 * M, lng: ORIGIN.lng };
const TZ_TODAY = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

type Step = [
  offsetSec: number,
  where: 'in' | 'out' | { lat: number; lng: number },
  extra?: { accuracyM?: number; isMock?: boolean },
];

/** Sends one batch of fixes; positions are relative to `now` so they fall inside the shift window. */
function ride(token: string, sessionId: string, steps: Step[], seqStart = 1) {
  return sendTelemetry(
    token,
    sessionId,
    steps.map(([offsetSec, where, extra], index) => {
      const pos = where === 'in' ? INSIDE : where === 'out' ? OUTSIDE : where;
      return sample({
        seq: seqStart + index,
        offsetSec,
        lat: pos.lat,
        lng: pos.lng,
        accuracyM: extra?.accuracyM ?? 8,
        isMock: extra?.isMock,
      });
    }),
  ).expect(200);
}

/** out → inside for 90 s (dwell ≥ 60 s) → out for 20 s (exit debounce). */
const FULL_VISIT: Step[] = [
  [-110, 'out'],
  ...Array.from({ length: 9 }, (_, k): Step => [-100 + k * 10, 'in']),
  [-10, 'out'],
  [0, 'out'],
  [10, 'out'],
];

interface VisitRow {
  id: string;
  status: string;
  isOpen: boolean;
  reviewReasons: string[];
  signals: { sampleCount: number };
  evidence: { type: string }[];
  [key: string]: unknown;
}

describe('geofencing & visits', () => {
  let org: OrgFixture;
  let teamId: string;
  let locationId: string;
  let managerToken: string;

  async function newAgent() {
    const agent = await createAgent(org.adminToken, teamId);
    const token = await activate(agent.email);
    const sessionId = await startShift(token);
    return { ...agent, token, sessionId };
  }

  async function assign(agentId: string, extra: object = {}) {
    const res = await as(org.adminToken)
      .post('/api/v1/assignments')
      .send({
        agentId,
        locationId,
        scheduledDate: TZ_TODAY(),
        window: {
          start: new Date(Date.now() - 3_600_000).toISOString(),
          end: new Date(Date.now() + 3_600_000).toISOString(),
        },
        ...extra,
      })
      .expect(201);
    return res.body.data.id as string;
  }

  const visitsOf = async (agentId: string) =>
    (await as(org.adminToken).get(`/api/v1/visits?agentId=${agentId}`)).body.data as VisitRow[];

  beforeAll(async () => {
    org = await registerOrg('Visits Org');
    const manager = await createManager(org.adminToken);
    managerToken = manager.token;
    teamId = await createTeam(org.adminToken, 'Field', [manager.id]);
    const loc = await as(org.adminToken)
      .post('/api/v1/locations')
      .send({
        name: 'Client Store',
        position: INSIDE,
        geofence: { shape: 'circle', radiusM: 100 },
        visitRules: { minDwellSec: 60 },
      })
      .expect(201);
    locationId = loc.body.data.id as string;
  });

  it('auto visit: entry → dwell → exit is verified and completes the assignment', async () => {
    const agent = await newAgent();
    const assignmentId = await assign(agent.id);
    await ride(agent.token, agent.sessionId, FULL_VISIT);

    const [visit] = await visitsOf(agent.id);
    expect(visit).toMatchObject({
      method: 'auto',
      status: 'verified',
      isOpen: false,
      assignmentId,
      durationSec: 90,
      reviewReasons: [],
      arrival: { onTime: true },
    });
    expect(visit!.signals.sampleCount).toBe(9);
    expect(visit!.evidence.map((e) => e.type)).toEqual(['geofence_entry', 'geofence_exit']);

    const assignment = await as(org.adminToken).get(`/api/v1/assignments/${assignmentId}`);
    expect(assignment.body.data.status).toBe('completed');
    const history = assignment.body.data.statusHistory as { status: string; by: string | null }[];
    expect(history.slice(-2)).toEqual([
      expect.objectContaining({ status: 'in_progress', by: null }),
      expect.objectContaining({ status: 'completed', by: null }),
    ]);

    const events = await as(org.adminToken).get(`/api/v1/geofence-events?agentId=${agent.id}`);
    expect((events.body.data as { type: string }[]).map((e) => e.type)).toEqual([
      'exited',
      'entered',
    ]);
    expect(events.body.data[0].dwellSec).toBe(90);
    expect(await getPresence(org.orgId, agent.id)).toBeNull();
  });

  it('a drive-by shorter than the minimum dwell creates events but no visit', async () => {
    const agent = await newAgent();
    await ride(agent.token, agent.sessionId, [
      [-60, 'out'],
      [-50, 'in'],
      [-40, 'in'],
      [-30, 'out'],
      [-10, 'out'],
    ]);
    expect(await visitsOf(agent.id)).toHaveLength(0);
    const events = await as(org.adminToken).get(`/api/v1/geofence-events?agentId=${agent.id}`);
    expect(events.body.meta.total).toBe(2);
  });

  it('GPS jitter at the boundary does not create a false exit', async () => {
    const agent = await newAgent();
    const edge = { lat: ORIGIN.lat + 106 * M, lng: ORIGIN.lng }; // 6 m outside, within the 10 m buffer
    await ride(agent.token, agent.sessionId, [
      [-100, 'in'],
      [-90, edge],
      [-80, 'in'],
      [-70, edge],
      [-60, edge],
      [-50, edge],
      [-40, 'in'],
      [-30, 'in'],
    ]);
    const events = await as(org.adminToken).get(`/api/v1/geofence-events?agentId=${agent.id}`);
    expect((events.body.data as { type: string }[]).map((e) => e.type)).toEqual(['entered']);
    const [visit] = await visitsOf(agent.id);
    expect(visit).toMatchObject({ status: 'in_progress', isOpen: true });
  });

  it('weak GPS evidence goes to review instead of being verified', async () => {
    const lowAccuracy = await newAgent();
    await ride(
      lowAccuracy.token,
      lowAccuracy.sessionId,
      FULL_VISIT.map(([t, w]) => [t, w, { accuracyM: 80 }] as Step),
    );
    expect((await visitsOf(lowAccuracy.id))[0]).toMatchObject({
      status: 'needs_review',
      reviewReasons: ['low_accuracy'],
    });

    const mock = await newAgent();
    await ride(
      mock.token,
      mock.sessionId,
      FULL_VISIT.map(([t, w], i) => [t, w, { isMock: i === 4 }] as Step),
    );
    expect((await visitsOf(mock.id))[0]).toMatchObject({
      status: 'needs_review',
      reviewReasons: ['mock_location'],
    });
  });

  it('manual check-in/out: inside with GPS presence, outside flagged, one open visit at a time', async () => {
    const agent = await newAgent();
    const assignmentId = await assign(agent.id);
    await ride(agent.token, agent.sessionId, [
      [-100, 'out'],
      [-90, 'in'],
      [-80, 'in'],
    ]);

    const checkIn = await as(agent.token)
      .post('/api/v1/visits/check-in')
      .send({ assignmentId, position: INSIDE, accuracyM: 6 });
    expect(checkIn.status).toBe(200);
    expect(checkIn.body.data).toMatchObject({
      method: 'manual',
      status: 'in_progress',
      assignmentId,
      reviewReasons: [],
    });
    const visitId = checkIn.body.data.id as string;

    // Idempotent for the same site; another site is refused while this one is open.
    expect(
      (
        await as(agent.token)
          .post('/api/v1/visits/check-in')
          .send({ assignmentId, position: INSIDE, accuracyM: 6 })
      ).body.data.id,
    ).toBe(visitId);
    const other = await as(org.adminToken)
      .post('/api/v1/locations')
      .send({ name: 'Other Site', position: OUTSIDE })
      .expect(201);
    const elsewhere = await as(agent.token)
      .post('/api/v1/visits/check-in')
      .send({ locationId: other.body.data.id, position: OUTSIDE, accuracyM: 5 });
    expect(elsewhere.status).toBe(409);

    await ride(
      agent.token,
      agent.sessionId,
      [
        [-30, 'in'],
        [-20, 'in'],
        [-10, 'in'],
      ],
      10,
    );
    const checkOut = await as(agent.token)
      .post(`/api/v1/visits/${visitId}/check-out`)
      .send({ position: INSIDE, accuracyM: 6 });
    expect(checkOut.body.data).toMatchObject({ status: 'verified', isOpen: false });
    expect(checkOut.body.data.durationSec).toBeGreaterThanOrEqual(80);

    const outsider = await newAgent();
    const outsideCheckIn = await as(outsider.token)
      .post('/api/v1/visits/check-in')
      .send({ locationId, position: OUTSIDE, accuracyM: 5 });
    expect(outsideCheckIn.body.data.reviewReasons).toEqual(['checkin_outside_geofence']);
    const closed = await as(outsider.token)
      .post(`/api/v1/visits/${outsideCheckIn.body.data.id as string}/check-out`)
      .send({ position: OUTSIDE, accuracyM: 5 });
    expect(closed.body.data.status).toBe('needs_review');
    expect(closed.body.data.reviewReasons).toEqual(
      expect.arrayContaining(['checkin_outside_geofence', 'no_gps_presence', 'insufficient_dwell']),
    );
  });

  it('managers review flagged visits (audited); agents and other teams cannot', async () => {
    const agent = await newAgent();
    const assignmentId = await assign(agent.id);
    await ride(
      agent.token,
      agent.sessionId,
      FULL_VISIT.map(([t, w]) => [t, w, { accuracyM: 80 }] as Step),
    );
    const [visit] = await visitsOf(agent.id);
    expect(visit!.status).toBe('needs_review');

    expect(
      (
        await as(agent.token)
          .post(`/api/v1/visits/${visit!.id}/review`)
          .send({ decision: 'verified' })
      ).status,
    ).toBe(403);
    expect(
      (
        await as(managerToken)
          .post(`/api/v1/visits/${visit!.id}/review`)
          .send({ decision: 'rejected' })
      ).status,
    ).toBe(400);

    const reviewed = await as(managerToken)
      .post(`/api/v1/visits/${visit!.id}/review`)
      .send({ decision: 'verified', note: 'Confirmed by phone with the client' });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data).toMatchObject({
      status: 'verified',
      review: { decision: 'verified' },
    });
    expect(
      (await as(org.adminToken).get(`/api/v1/assignments/${assignmentId}`)).body.data.status,
    ).toBe('completed');

    const audit = await as(org.adminToken).get(`/api/v1/audit-logs?entityId=${visit!.id}`);
    expect(audit.body.data[0].action).toBe('visit.verified_manually');

    const otherOrg = await registerOrg('Visits Other Org');
    expect((await as(otherOrg.adminToken).get(`/api/v1/visits/${visit!.id}`)).status).toBe(404);
  });

  it('ending the shift closes the stay; lost signal inside is flagged', async () => {
    const shiftEnder = await newAgent();
    await ride(shiftEnder.token, shiftEnder.sessionId, [
      [-100, 'out'],
      ...Array.from({ length: 9 }, (_, k): Step => [-90 + k * 10, 'in']),
    ]);
    expect((await visitsOf(shiftEnder.id))[0]).toMatchObject({ isOpen: true });
    await as(shiftEnder.token).post('/api/v1/shifts/end').expect(200);
    expect((await visitsOf(shiftEnder.id))[0]).toMatchObject({
      isOpen: false,
      status: 'verified',
      durationSec: 80,
    });

    const silent = await newAgent();
    await ride(silent.token, silent.sessionId, [
      [-100, 'out'],
      ...Array.from({ length: 9 }, (_, k): Step => [-90 + k * 10, 'in']),
    ]);
    expect(await sweepStalePresences(org.orgId, Date.now() + 10 * 60_000)).toBeGreaterThanOrEqual(
      1,
    );
    const [lost] = await visitsOf(silent.id);
    expect(lost).toMatchObject({
      isOpen: false,
      status: 'needs_review',
      reviewReasons: ['signal_lost'],
    });
  });

  it('assignment sweep: deadline passed → overdue; past day → missed visit (once)', async () => {
    const agent = await newAgent();
    const late = await assign(agent.id, {
      window: null,
      deadline: new Date(Date.now() - 60_000).toISOString(),
    });
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
      new Date(Date.now() - 86_400_000),
    );
    const past = await Assignment.create({
      orgId: toObjectId(org.orgId),
      agentId: toObjectId(agent.id),
      teamId: toObjectId(teamId),
      locationId: toObjectId(locationId),
      scheduledDate: yesterday,
      statusHistory: [],
      createdBy: toObjectId(org.adminId),
    });

    const first = await runAssignmentSweep();
    expect(first.overdue).toBeGreaterThanOrEqual(1);
    expect(first.missed).toBeGreaterThanOrEqual(1);
    expect((await as(org.adminToken).get(`/api/v1/assignments/${late}`)).body.data.status).toBe(
      'overdue',
    );

    const missed = await as(org.adminToken).get(
      `/api/v1/visits?assignmentId=${past._id.toString()}`,
    );
    expect(missed.body.data).toHaveLength(1);
    expect(missed.body.data[0]).toMatchObject({
      status: 'missed',
      visitDate: yesterday,
      checkInAt: null,
    });
    expect((await runAssignmentSweep()).missed).toBe(0);
  });
});

describe('route analysis', () => {
  it('returns stops, gaps and planned vs actual order', async () => {
    const org = await registerOrg('Route Org');
    const agent = await createAgent(org.adminToken, null);
    const loc = await as(org.adminToken)
      .post('/api/v1/locations')
      .send({ name: 'Depot', position: ORIGIN, geofence: { shape: 'circle', radiusM: 80 } })
      .expect(201);

    // History written directly: 5 min parked at the depot, a 4 min gap, 4 min parked off-site.
    const base = Date.now() - 60 * 60_000;
    const offsite = { lat: ORIGIN.lat + 3000 * M, lng: ORIGIN.lng };
    const rows = [
      ...Array.from({ length: 11 }, (_, k) => ({ t: base + k * 30_000, ...ORIGIN })),
      ...Array.from({ length: 9 }, (_, k) => ({ t: base + 540_000 + k * 30_000, ...offsite })),
    ];
    await LocationTelemetry.insertMany(
      rows.map((row, seq) => ({
        recordedAt: new Date(row.t),
        receivedAt: new Date(row.t),
        meta: {
          orgId: toObjectId(org.orgId),
          agentId: toObjectId(agent.id),
          sessionId: toObjectId(agent.id),
        },
        seq,
        lat: row.lat,
        lng: row.lng,
        accuracyM: 8,
        flags: [],
      })),
    );

    const from = new Date(base - 60_000).toISOString();
    const res = await as(org.adminToken).get(
      `/api/v1/agents/${agent.id}/route-analysis?from=${encodeURIComponent(from)}`,
    );
    expect(res.status).toBe(200);
    const analysis = res.body.data;
    expect(analysis.pointCount).toBe(20);
    expect(analysis.stops).toHaveLength(2);
    expect(analysis.stops[0]).toMatchObject({
      kind: 'client_site',
      locationId: loc.body.data.id,
      durationSec: 300,
    });
    expect(analysis.stops[1]).toMatchObject({
      kind: 'unplanned',
      locationId: null,
      durationSec: 240,
    });
    expect(analysis.gaps).toEqual([expect.objectContaining({ durationSec: 240 })]);
    expect(analysis.distanceM).toBeGreaterThan(2900);
  });
});
