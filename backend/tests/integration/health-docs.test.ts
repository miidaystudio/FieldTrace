import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api.js';

describe('health & docs', () => {
  it('GET /health returns ok with a request id header', async () => {
    const res = await api.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('GET /ready reports MongoDB and Redis connections', async () => {
    const res = await api.get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ready', mongo: 'connected', redis: 'connected' });
  });

  it('echoes a well-formed incoming X-Request-Id', async () => {
    const res = await api.get('/api/v1/health').set('X-Request-Id', 'client-req-12345');
    expect(res.headers['x-request-id']).toBe('client-req-12345');
  });

  it('unknown routes return the error envelope', async () => {
    const res = await api.get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('serves an OpenAPI 3.1 document covering every module', async () => {
    const res = await api.get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    const paths = Object.keys(res.body.paths as object);
    for (const expected of [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/organization',
      '/api/v1/users/{id}',
      '/api/v1/teams',
      '/api/v1/agents/me',
      '/api/v1/agents/{id}',
      '/api/v1/locations',
      '/api/v1/assignments/{id}/status',
      '/api/v1/audit-logs',
      '/api/v1/shifts/start',
      '/api/v1/telemetry',
      '/api/v1/fleet/live',
      '/api/v1/agents/{id}/track',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const res = await api
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
