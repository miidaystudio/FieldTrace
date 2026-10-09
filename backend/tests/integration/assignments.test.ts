import { beforeAll, describe, expect, it } from 'vitest';
import {
  activate,
  as,
  createAgent,
  createLocation,
  createTeam,
  registerOrg,
  type OrgFixture,
} from '../helpers/api.js';

describe('assignments', () => {
  let org: OrgFixture;
  let agentId: string;
  let otherAgentId: string;
  let agentToken: string;
  let locationId: string;

  const create = (body: object = {}) =>
    as(org.adminToken)
      .post('/api/v1/assignments')
      .send({ agentId, locationId, scheduledDate: '2026-10-12', ...body });

  beforeAll(async () => {
    org = await registerOrg('Assign Org');
    const teamId = await createTeam(org.adminToken, 'Ops');
    const agent = await createAgent(org.adminToken, teamId, { name: 'Kiran' });
    agentId = agent.id;
    agentToken = await activate(agent.email);
    otherAgentId = (await createAgent(org.adminToken, teamId)).id;
    locationId = await createLocation(org.adminToken, { name: 'MG Road Store' });
  });

  it('creates an assignment with embedded agent and location summaries', async () => {
    const res = await create({
      priority: 'high',
      window: { start: '2026-10-12T04:30:00.000Z', end: '2026-10-12T06:30:00.000Z' },
      deadline: '2026-10-12T08:00:00.000Z',
      title: 'Monthly stock audit',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      agentId,
      locationId,
      agent: { id: agentId, name: 'Kiran' },
      location: { id: locationId, name: 'MG Road Store', position: { lat: 12.9716, lng: 77.5946 } },
      status: 'pending',
      priority: 'high',
      scheduledDate: '2026-10-12',
      window: { start: '2026-10-12T04:30:00.000Z', end: '2026-10-12T06:30:00.000Z' },
    });
    expect(res.body.data.statusHistory).toHaveLength(1);
  });

  it('validates time windows and dates', async () => {
    const backwards = await create({
      window: { start: '2026-10-12T06:00:00Z', end: '2026-10-12T05:00:00Z' },
    });
    expect(backwards.status).toBe(400);
    const badDate = await create({ scheduledDate: '12/10/2026' });
    expect(badDate.status).toBe(400);
  });

  it('rejects archived locations and deactivated agents', async () => {
    const archived = await createLocation(org.adminToken, { name: 'Gone' });
    await as(org.adminToken).post(`/api/v1/locations/${archived}/archive`).expect(200);
    expect((await create({ locationId: archived })).status).toBe(400);

    const leaver = await createAgent(org.adminToken, null);
    await as(org.adminToken).post(`/api/v1/agents/${leaver.id}/deactivate`).expect(200);
    expect((await create({ agentId: leaver.id })).status).toBe(400);
  });

  it('follows the status state machine and records history', async () => {
    const id = (await create()).body.data.id as string;
    const status = (body: object, token = org.adminToken) =>
      as(token).post(`/api/v1/assignments/${id}/status`).send(body);

    const cancelNoReason = await status({ status: 'cancelled' });
    expect(cancelNoReason.status).toBe(400);

    expect((await status({ status: 'in_progress' })).body.data.status).toBe('in_progress');
    const done = await status({ status: 'completed' });
    expect(done.body.data.status).toBe('completed');
    expect((done.body.data.statusHistory as { status: string }[]).map((h) => h.status)).toEqual([
      'pending',
      'in_progress',
      'completed',
    ]);

    const reopen = await status({ status: 'in_progress' });
    expect(reopen.status).toBe(409);
    expect(reopen.body.error.code).toBe('INVALID_STATE_TRANSITION');

    const edit = await as(org.adminToken)
      .patch(`/api/v1/assignments/${id}`)
      .send({ notes: 'too late' });
    expect(edit.status).toBe(409);
  });

  it('agents see and progress only their own work, and cannot cancel', async () => {
    const own = (await create({ scheduledDate: '2026-10-13' })).body.data.id as string;
    const foreign = (await create({ agentId: otherAgentId, scheduledDate: '2026-10-13' })).body.data
      .id as string;

    const mine = await as(agentToken).get('/api/v1/assignments/mine?date=2026-10-13');
    expect((mine.body.data as { id: string }[]).map((a) => a.id)).toEqual([own]);

    expect((await as(agentToken).get(`/api/v1/assignments/${foreign}`)).status).toBe(404);
    expect(
      (
        await as(agentToken)
          .post(`/api/v1/assignments/${foreign}/status`)
          .send({ status: 'in_progress' })
      ).status,
    ).toBe(404);

    const cancel = await as(agentToken)
      .post(`/api/v1/assignments/${own}/status`)
      .send({ status: 'cancelled', reason: 'not going' });
    expect(cancel.status).toBe(409);
    const start = await as(agentToken)
      .post(`/api/v1/assignments/${own}/status`)
      .send({ status: 'in_progress' });
    expect(start.status).toBe(200);
  });

  it('reassignment is audited', async () => {
    const id = (await create({ scheduledDate: '2026-10-14' })).body.data.id as string;
    const res = await as(org.adminToken)
      .patch(`/api/v1/assignments/${id}`)
      .send({ agentId: otherAgentId });
    expect(res.body.data.agentId).toBe(otherAgentId);
    const audit = await as(org.adminToken).get(
      `/api/v1/audit-logs?entityId=${id}&action=assignment.reassigned`,
    );
    expect(audit.body.data[0].changes.agentId).toEqual({ from: agentId, to: otherAgentId });
  });

  it('filters by date range and status', async () => {
    const res = await as(org.adminToken).get(
      '/api/v1/assignments?dateFrom=2026-10-12&dateTo=2026-10-13&status=pending,in_progress&sort=-scheduledDate',
    );
    expect(res.status).toBe(200);
    const rows = res.body.data as { scheduledDate: string; status: string }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(['2026-10-12', '2026-10-13']).toContain(row.scheduledDate);
      expect(['pending', 'in_progress']).toContain(row.status);
    }
    expect(rows[0]!.scheduledDate >= rows.at(-1)!.scheduledDate).toBe(true);

    expect((await as(org.adminToken).get('/api/v1/assignments?status=bogus')).status).toBe(400);
  });
});
