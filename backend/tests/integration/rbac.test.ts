import { beforeAll, describe, expect, it } from 'vitest';
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

describe('role-based access & manager team scope', () => {
  let org: OrgFixture;
  let managerToken: string;
  let managerId: string;
  let agentToken: string;
  const ids = { northTeam: '', southTeam: '', northAgent: '', southAgent: '', location: '' };

  beforeAll(async () => {
    org = await registerOrg('Scope Org');
    const manager = await createManager(org.adminToken);
    managerToken = manager.token;
    managerId = manager.id;
    ids.northTeam = await createTeam(org.adminToken, 'North', [managerId]);
    ids.southTeam = await createTeam(org.adminToken, 'South');
    const north = await createAgent(org.adminToken, ids.northTeam, { employeeCode: 'N-001' });
    ids.northAgent = north.id;
    ids.southAgent = (await createAgent(org.adminToken, ids.southTeam)).id;
    ids.location = await createLocation(org.adminToken);
    agentToken = await activate(north.email);
  });

  describe('role gates', () => {
    it.each([
      ['GET', '/api/v1/users'],
      ['POST', '/api/v1/teams'],
      ['PATCH', '/api/v1/organization'],
      ['GET', '/api/v1/audit-logs'],
    ])('manager gets 403 on admin-only %s %s', async (method, path) => {
      const client = as(managerToken);
      const res =
        method === 'GET'
          ? await client.get(path)
          : method === 'POST'
            ? await client.post(path).send({})
            : await client.patch(path).send({});
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it.each([
      '/api/v1/agents',
      '/api/v1/teams',
      '/api/v1/locations',
      '/api/v1/assignments',
      '/api/v1/users',
    ])('agent gets 403 on management route %s', async (path) => {
      expect((await as(agentToken).get(path)).status).toBe(403);
    });

    it('agents can read their own profile and organization', async () => {
      const me = await as(agentToken).get('/api/v1/agents/me');
      expect(me.status).toBe(200);
      expect(me.body.data).toMatchObject({
        id: ids.northAgent,
        employeeCode: 'N-001',
        shiftStatus: 'off_shift',
      });
      expect((await as(agentToken).get('/api/v1/organization')).status).toBe(200);
    });

    it('staff cannot use the agent-only /agents/me route', async () => {
      expect((await as(org.adminToken).get('/api/v1/agents/me')).status).toBe(403);
    });
  });

  describe('manager scope', () => {
    it('lists only the teams the manager manages', async () => {
      const res = await as(managerToken).get('/api/v1/teams');
      expect((res.body.data as { id: string }[]).map((t) => t.id)).toEqual([ids.northTeam]);
    });

    it('lists only agents in managed teams', async () => {
      const res = await as(managerToken).get('/api/v1/agents');
      const agentIds = (res.body.data as { id: string }[]).map((a) => a.id);
      expect(agentIds).toEqual([ids.northAgent]);
      expect(res.body.meta.total).toBe(1);
    });

    it('cannot read or edit an agent outside their teams (404, not 403)', async () => {
      expect((await as(managerToken).get(`/api/v1/agents/${ids.southAgent}`)).status).toBe(404);
      expect(
        (
          await as(managerToken)
            .patch(`/api/v1/agents/${ids.southAgent}`)
            .send({ phone: '+911234567' })
        ).status,
      ).toBe(404);
      expect((await as(managerToken).get(`/api/v1/teams/${ids.southTeam}`)).status).toBe(404);
    });

    it('cannot create agents outside their teams or without a team', async () => {
      const other = await as(managerToken).post('/api/v1/agents').send({
        name: 'X',
        email: 'scope-x@example.test',
        temporaryPassword: 'test-password-123',
        teamId: ids.southTeam,
      });
      expect(other.status).toBe(400);
      const none = await as(managerToken)
        .post('/api/v1/agents')
        .send({ name: 'Y', email: 'scope-y@example.test', temporaryPassword: 'test-password-123' });
      expect(none.status).toBe(403);
    });

    it('can create agents in their own team', async () => {
      const agent = await createAgent(managerToken, ids.northTeam);
      const list = await as(managerToken).get('/api/v1/agents?sort=-createdAt');
      expect((list.body.data as { id: string }[])[0]?.id).toBe(agent.id);
    });

    it('cannot assign work to agents outside their teams', async () => {
      const res = await as(managerToken)
        .post('/api/v1/assignments')
        .send({ agentId: ids.southAgent, locationId: ids.location, scheduledDate: '2026-10-10' });
      expect(res.status).toBe(404);
    });

    it('sees only assignments of their teams', async () => {
      await as(org.adminToken)
        .post('/api/v1/assignments')
        .send({ agentId: ids.southAgent, locationId: ids.location, scheduledDate: '2026-10-11' })
        .expect(201);
      const mine = await as(managerToken)
        .post('/api/v1/assignments')
        .send({ agentId: ids.northAgent, locationId: ids.location, scheduledDate: '2026-10-11' })
        .expect(201);
      const res = await as(managerToken).get('/api/v1/assignments?date=2026-10-11');
      expect((res.body.data as { id: string }[]).map((x) => x.id)).toEqual([mine.body.data.id]);
    });
  });

  describe('admin safeguards', () => {
    it('the last active admin cannot be demoted or deactivated', async () => {
      const demote = await as(org.adminToken)
        .patch(`/api/v1/users/${org.adminId}`)
        .send({ role: 'manager' });
      expect(demote.status).toBe(403); // cannot change own role
      const self = await as(org.adminToken).post(`/api/v1/users/${org.adminId}/deactivate`);
      expect(self.status).toBe(403);
    });

    it('agent accounts cannot be promoted through /users', async () => {
      const agent = await as(org.adminToken).get(`/api/v1/agents/${ids.southAgent}`);
      const res = await as(org.adminToken)
        .patch(`/api/v1/users/${agent.body.data.userId as string}`)
        .send({ role: 'manager' });
      expect(res.status).toBe(409);
    });
  });
});
