import { beforeAll, describe, expect, it } from 'vitest';
import { as, registerOrg, type OrgFixture } from '../helpers/api.js';

const center = { lat: 12.9716, lng: 77.5946 };
const square = [
  { lat: 12.9706, lng: 77.5936 },
  { lat: 12.9706, lng: 77.5956 },
  { lat: 12.9726, lng: 77.5956 },
  { lat: 12.9726, lng: 77.5936 },
];

describe('locations & geofences', () => {
  let org: OrgFixture;
  const post = (body: object) => as(org.adminToken).post('/api/v1/locations').send(body);

  beforeAll(async () => {
    org = await registerOrg('Geo Org');
  });

  it('defaults to a circular geofence and visit rules from organization settings', async () => {
    const res = await post({ name: 'Pharmacy', position: center });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      position: center,
      geofence: { shape: 'circle', radiusM: 100 },
      visitRules: { minDwellSec: 120, requireQr: false, requirePhoto: false },
      isArchived: false,
    });
  });

  it('stores polygon geofences and returns vertices without the closing point', async () => {
    const res = await post({
      name: 'Warehouse',
      position: center,
      geofence: { shape: 'polygon', vertices: square },
      tags: ['Depot', 'depot'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.geofence).toEqual({ shape: 'polygon', vertices: square });
    expect(res.body.data.tags).toEqual(['depot']);
  });

  it.each([
    ['radius below minimum', { geofence: { shape: 'circle', radiusM: 5 } }],
    ['radius above maximum', { geofence: { shape: 'circle', radiusM: 50_000 } }],
    ['too few vertices', { geofence: { shape: 'polygon', vertices: square.slice(0, 2) } }],
    [
      'position outside polygon',
      { position: { lat: 13.5, lng: 77.5 }, geofence: { shape: 'polygon', vertices: square } },
    ],
    [
      'self-intersecting polygon',
      { geofence: { shape: 'polygon', vertices: [square[0], square[2], square[1], square[3]] } },
    ],
    ['latitude out of range', { position: { lat: 91, lng: 0 } }],
    ['unknown shape', { geofence: { shape: 'hexagon' } }],
  ])('rejects %s', async (_label, override) => {
    const res = await post({ name: 'Bad', position: center, ...override });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('finds locations within a radius', async () => {
    await post({ name: 'Far Away', position: { lat: 28.6139, lng: 77.209 } });
    const near = await as(org.adminToken).get(
      `/api/v1/locations?nearLat=${center.lat}&nearLng=${center.lng}&withinM=2000`,
    );
    const names = (near.body.data as { name: string }[]).map((l) => l.name);
    expect(names).toContain('Pharmacy');
    expect(names).not.toContain('Far Away');

    const partial = await as(org.adminToken).get(`/api/v1/locations?nearLat=${center.lat}`);
    expect(partial.status).toBe(400);
  });

  it('audits geofence changes with before/after values', async () => {
    const created = await post({ name: 'Audited', position: center });
    const id = created.body.data.id as string;
    const res = await as(org.adminToken)
      .patch(`/api/v1/locations/${id}`)
      .send({ geofence: { shape: 'circle', radiusM: 250 } });
    expect(res.status).toBe(200);
    expect(res.body.data.geofence).toEqual({ shape: 'circle', radiusM: 250 });

    const audit = await as(org.adminToken).get(
      `/api/v1/audit-logs?entityId=${id}&action=location.geofence_changed`,
    );
    expect(audit.body.data[0].changes.geofence).toEqual({
      from: { shape: 'circle', radiusM: 100 },
      to: { shape: 'circle', radiusM: 250 },
    });
  });

  it('re-validates an existing polygon when the position moves outside it', async () => {
    const created = await post({
      name: 'Poly',
      position: center,
      geofence: { shape: 'polygon', vertices: square },
    });
    const res = await as(org.adminToken)
      .patch(`/api/v1/locations/${created.body.data.id as string}`)
      .send({ position: { lat: 12.99, lng: 77.6 } });
    expect(res.status).toBe(400);
  });

  it('archived locations are hidden by default', async () => {
    const created = await post({ name: 'Closing Down', position: center });
    const id = created.body.data.id as string;
    await as(org.adminToken).post(`/api/v1/locations/${id}/archive`).expect(200);
    const list = await as(org.adminToken).get('/api/v1/locations?q=closing');
    expect(list.body.meta.total).toBe(0);
    const withArchived = await as(org.adminToken).get(
      '/api/v1/locations?q=closing&includeArchived=true',
    );
    expect(withArchived.body.meta.total).toBe(1);
  });
});
