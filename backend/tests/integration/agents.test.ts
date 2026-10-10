import { beforeAll, describe, expect, it } from 'vitest';
import {
  as,
  createAgent,
  createTeam,
  login,
  registerOrg,
  type OrgFixture,
} from '../helpers/api.js';

describe('agents', () => {
  let org: OrgFixture;
  let teamId: string;

  beforeAll(async () => {
    org = await registerOrg('Agents Org');
    teamId = await createTeam(org.adminToken, 'Riders');
  });

  it('creates an agent with a login account and default profile', async () => {
    const res = await as(org.adminToken)
      .post('/api/v1/agents')
      .send({
        name: 'Arjun Mehta',
        email: 'arjun@agents.test',
        temporaryPassword: 'test-password-123',
        teamId,
        employeeCode: 'EMP-7',
        phone: '+91 98765 43210',
        vehicle: { type: 'motorcycle', plate: 'KA01AB1234' },
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Arjun Mehta',
      email: 'arjun@agents.test',
      status: 'active',
      mustChangePassword: true,
      teamId,
      employeeCode: 'EMP-7',
      vehicle: { type: 'motorcycle', plate: 'KA01AB1234' },
      shiftStatus: 'off_shift',
      lastLocation: null,
      lastSeenAt: null,
    });
  });

  it('rejects duplicate employee codes within the org', async () => {
    const res = await as(org.adminToken).post('/api/v1/agents').send({
      name: 'Dup',
      email: 'dup@agents.test',
      temporaryPassword: 'test-password-123',
      employeeCode: 'EMP-7',
    });
    expect(res.status).toBe(409);
  });

  it('rejects adding agents to archived teams', async () => {
    const archived = await createTeam(org.adminToken, 'Old Team');
    await as(org.adminToken).post(`/api/v1/teams/${archived}/archive`).expect(200);
    const res = await as(org.adminToken).post('/api/v1/agents').send({
      name: 'Late',
      email: 'late@agents.test',
      temporaryPassword: 'test-password-123',
      teamId: archived,
    });
    expect(res.status).toBe(400);
  });

  it('searches, filters, sorts and paginates', async () => {
    await createAgent(org.adminToken, teamId, { name: 'Zara Khan' });
    await createAgent(org.adminToken, teamId, { name: 'Bina Rao' });

    const search = await as(org.adminToken).get('/api/v1/agents?q=zara');
    expect((search.body.data as { name: string }[]).map((a) => a.name)).toEqual(['Zara Khan']);

    const byCode = await as(org.adminToken).get('/api/v1/agents?q=emp-7');
    expect(byCode.body.meta.total).toBe(1);

    const page = await as(org.adminToken).get(
      `/api/v1/agents?teamId=${teamId}&sort=-name&limit=2&page=1`,
    );
    expect(page.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect((page.body.data as { name: string }[]).map((a) => a.name)).toEqual([
      'Zara Khan',
      'Bina Rao',
    ]);

    const bad = await as(org.adminToken).get('/api/v1/agents?sort=passwordHash');
    expect(bad.status).toBe(400);
    const tooBig = await as(org.adminToken).get('/api/v1/agents?limit=1000');
    expect(tooBig.status).toBe(400);
  });

  it('updates agent details and records the team change in the audit log', async () => {
    const agent = await createAgent(org.adminToken, teamId);
    const otherTeam = await createTeam(org.adminToken, 'Vans');
    const res = await as(org.adminToken)
      .patch(`/api/v1/agents/${agent.id}`)
      .send({ name: 'Renamed Agent', teamId: otherTeam, vehicle: { type: 'van', plate: null } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Renamed Agent',
      teamId: otherTeam,
      vehicle: { type: 'van' },
    });

    const audit = await as(org.adminToken).get(`/api/v1/audit-logs?entityId=${agent.id}`);
    const entry = (audit.body.data as { action: string; changes: Record<string, unknown> }[])[0]!;
    expect(entry.action).toBe('agent.team_changed');
    expect(entry.changes).toMatchObject({
      teamId: { from: teamId, to: otherTeam },
      name: { to: 'Renamed Agent' },
    });
  });

  it('deactivating an agent blocks login and revokes sessions; reactivation restores it', async () => {
    const agent = await createAgent(org.adminToken, teamId);
    const token = await login(agent.email);
    const off = await as(org.adminToken).post(`/api/v1/agents/${agent.id}/deactivate`);
    expect(off.body.data.status).toBe('deactivated');
    expect((await as(token).get('/api/v1/auth/me')).status).toBe(401);

    const filtered = await as(org.adminToken).get('/api/v1/agents?status=deactivated');
    expect((filtered.body.data as { id: string }[]).map((a) => a.id)).toContain(agent.id);

    await as(org.adminToken).post(`/api/v1/agents/${agent.id}/reactivate`).expect(200);
    await login(agent.email);
  });

  it('rejects malformed ids with 400', async () => {
    expect((await as(org.adminToken).get('/api/v1/agents/not-an-id')).status).toBe(400);
  });
});
