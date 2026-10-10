import { beforeAll, describe, expect, it } from 'vitest';
import { as, createManager, registerOrg, type OrgFixture } from '../helpers/api.js';

describe('organization settings & teams', () => {
  let org: OrgFixture;

  beforeAll(async () => {
    org = await registerOrg('Settings Org');
  });

  it('updates settings per key and validates cross-field rules', async () => {
    const res = await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({ timezone: 'Europe/London', settings: { staleAfterSec: 90 } });
    expect(res.status).toBe(200);
    expect(res.body.data.timezone).toBe('Europe/London');
    expect(res.body.data.settings.staleAfterSec).toBe(90);
    expect(res.body.data.settings.offlineAfterSec).toBe(300);

    const invalid = await as(org.adminToken)
      .patch('/api/v1/organization')
      .send({ settings: { offlineAfterSec: 60 } });
    expect(invalid.status).toBe(400);

    const audit = await as(org.adminToken).get('/api/v1/audit-logs?action=organization.updated');
    expect(audit.body.data[0].changes.timezone).toEqual({
      from: 'Asia/Kolkata',
      to: 'Europe/London',
    });
  });

  it('enforces case-insensitive unique team names', async () => {
    await as(org.adminToken).post('/api/v1/teams').send({ name: 'Night Shift' }).expect(201);
    const dup = await as(org.adminToken).post('/api/v1/teams').send({ name: 'night shift' });
    expect(dup.status).toBe(409);
  });

  it('only accepts active managers/admins of the same org as team managers', async () => {
    const manager = await createManager(org.adminToken);
    const ok = await as(org.adminToken)
      .post('/api/v1/teams')
      .send({ name: 'Day Shift', managerIds: [manager.id, manager.id] });
    expect(ok.status).toBe(201);
    expect(ok.body.data.managerIds).toEqual([manager.id]);

    const other = await registerOrg('Other Org');
    const foreign = await as(org.adminToken)
      .post('/api/v1/teams')
      .send({ name: 'Foreign', managerIds: [other.adminId] });
    expect(foreign.status).toBe(400);
  });

  it('archives and restores teams', async () => {
    const created = await as(org.adminToken).post('/api/v1/teams').send({ name: 'Seasonal' });
    const id = created.body.data.id as string;
    await as(org.adminToken).post(`/api/v1/teams/${id}/archive`).expect(200);
    const hidden = await as(org.adminToken).get('/api/v1/teams?q=seasonal');
    expect(hidden.body.meta.total).toBe(0);
    const shown = await as(org.adminToken).get('/api/v1/teams?q=seasonal&includeArchived=true');
    expect(shown.body.data[0].isArchived).toBe(true);
    await as(org.adminToken).post(`/api/v1/teams/${id}/unarchive`).expect(200);
  });

  it('audit logs are newest-first and filterable by action prefix', async () => {
    const res = await as(org.adminToken).get('/api/v1/audit-logs?action=team.');
    const rows = res.body.data as { action: string; at: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.action.startsWith('team.'))).toBe(true);
    const times = rows.map((r) => r.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
