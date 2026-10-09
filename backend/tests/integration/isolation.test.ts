import { beforeAll, describe, expect, it } from 'vitest';
import { Team } from '../../src/modules/teams/team.model.js';
import { AgentProfile } from '../../src/modules/agents/agent.model.js';
import {
  as,
  createAgent,
  createLocation,
  createManager,
  createTeam,
  registerOrg,
  type OrgFixture,
} from '../helpers/api.js';

/**
 * Organization isolation: a user must never read or modify another organization's data by
 * changing an id. Cross-org access must look exactly like "not found".
 */
describe('organization isolation', () => {
  let orgA: OrgFixture;
  let orgB: OrgFixture;
  const a = { teamId: '', agentId: '', locationId: '', assignmentId: '', managerId: '' };

  beforeAll(async () => {
    orgA = await registerOrg('Org A');
    orgB = await registerOrg('Org B');
    a.teamId = await createTeam(orgA.adminToken, 'A Team');
    a.agentId = (await createAgent(orgA.adminToken, a.teamId)).id;
    a.locationId = await createLocation(orgA.adminToken);
    a.managerId = (await createManager(orgA.adminToken)).id;
    const res = await as(orgA.adminToken)
      .post('/api/v1/assignments')
      .send({ agentId: a.agentId, locationId: a.locationId, scheduledDate: '2026-10-10' })
      .expect(201);
    a.assignmentId = res.body.data.id as string;
  });

  it.each([
    ['users', () => `/api/v1/users/${a.managerId}`],
    ['teams', () => `/api/v1/teams/${a.teamId}`],
    ['agents', () => `/api/v1/agents/${a.agentId}`],
    ['locations', () => `/api/v1/locations/${a.locationId}`],
    ['assignments', () => `/api/v1/assignments/${a.assignmentId}`],
  ])('GET another org’s %s by id returns 404', async (_name, path) => {
    const res = await as(orgB.adminToken).get(path());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['users', () => `/api/v1/users/${a.managerId}`, { name: 'pwned' }],
    ['teams', () => `/api/v1/teams/${a.teamId}`, { name: 'pwned' }],
    ['agents', () => `/api/v1/agents/${a.agentId}`, { name: 'pwned' }],
    ['locations', () => `/api/v1/locations/${a.locationId}`, { name: 'pwned' }],
    ['assignments', () => `/api/v1/assignments/${a.assignmentId}`, { notes: 'pwned' }],
  ])('PATCH another org’s %s returns 404 and changes nothing', async (_name, path, body) => {
    const res = await as(orgB.adminToken).patch(path()).send(body);
    expect(res.status).toBe(404);
    const still = await as(orgA.adminToken).get(path());
    expect(JSON.stringify(still.body.data)).not.toContain('pwned');
  });

  it.each([
    ['users', () => `/api/v1/users/${a.managerId}/deactivate`],
    ['agents', () => `/api/v1/agents/${a.agentId}/deactivate`],
    ['teams', () => `/api/v1/teams/${a.teamId}/archive`],
    ['locations', () => `/api/v1/locations/${a.locationId}/archive`],
  ])('state-changing actions on another org’s %s return 404', async (_name, path) => {
    expect((await as(orgB.adminToken).post(path())).status).toBe(404);
  });

  it('cannot create an assignment referencing another org’s agent or location', async () => {
    const bTeam = await createTeam(orgB.adminToken, 'B Team');
    const bAgent = (await createAgent(orgB.adminToken, bTeam)).id;
    const bLocation = await createLocation(orgB.adminToken);

    const foreignAgent = await as(orgB.adminToken)
      .post('/api/v1/assignments')
      .send({ agentId: a.agentId, locationId: bLocation, scheduledDate: '2026-10-10' });
    expect(foreignAgent.status).toBe(404);

    const foreignLocation = await as(orgB.adminToken)
      .post('/api/v1/assignments')
      .send({ agentId: bAgent, locationId: a.locationId, scheduledDate: '2026-10-10' });
    expect(foreignLocation.status).toBe(400);
  });

  it('cannot place an agent into another org’s team', async () => {
    const res = await as(orgB.adminToken).post('/api/v1/agents').send({
      name: 'X',
      email: 'x-cross@example.test',
      temporaryPassword: 'test-password-123',
      teamId: a.teamId,
    });
    expect(res.status).toBe(400);
  });

  it('lists only contain the caller’s organization data', async () => {
    for (const path of [
      '/api/v1/users',
      '/api/v1/teams',
      '/api/v1/agents',
      '/api/v1/locations',
      '/api/v1/assignments',
      '/api/v1/audit-logs',
    ]) {
      const res = await as(orgB.adminToken).get(path);
      expect(res.status, path).toBe(200);
      const ids = (res.body.data as { id: string }[]).map((item) => item.id);
      for (const foreignId of Object.values(a)) expect(ids, path).not.toContain(foreignId);
    }
  });

  it('organization settings are per-org', async () => {
    const res = await as(orgB.adminToken).get('/api/v1/organization');
    expect(res.body.data.id).toBe(orgB.orgId);
    expect(res.body.data.id).not.toBe(orgA.orgId);
  });

  it('the tenancy guard rejects queries that forget the orgId filter', async () => {
    await expect(Team.find({ name: 'A Team' })).rejects.toThrow(/Tenant isolation violation/);
    await expect(AgentProfile.countDocuments({})).rejects.toThrow(/Tenant isolation violation/);
    await expect(AgentProfile.aggregate([{ $match: {} }])).rejects.toThrow(
      /Tenant isolation violation/,
    );
    await expect(Team.find({ orgId: orgA.orgId })).resolves.toHaveLength(1);
  });
});
