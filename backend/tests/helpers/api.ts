import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../../src/app.js';

export const app = createApp();
export const api = supertest(app);

/** Test-only password that satisfies the password policy. */
export const PASSWORD = 'test-password-123';

export const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@example.test`;

type Method = 'get' | 'post' | 'patch' | 'delete';

/** Authenticated request helper: `as(token).get('/api/v1/agents')`. */
export function as(token: string) {
  const call = (method: Method) => (path: string) =>
    api[method](path).set('Authorization', `Bearer ${token}`);
  return { get: call('get'), post: call('post'), patch: call('patch'), delete: call('delete') };
}

export function refreshCookieFrom(res: supertest.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('ft_refresh='));
  expect(cookie, 'expected ft_refresh cookie').toBeDefined();
  return cookie!.split(';')[0]!;
}

export interface OrgFixture {
  orgId: string;
  adminId: string;
  adminToken: string;
  adminEmail: string;
  refreshCookie: string;
}

export async function registerOrg(name = 'Acme Logistics'): Promise<OrgFixture> {
  const adminEmail = uniqueEmail('admin');
  const res = await api.post('/api/v1/auth/register').send({
    organizationName: name,
    timezone: 'Asia/Kolkata',
    name: 'Org Admin',
    email: adminEmail,
    password: PASSWORD,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return {
    orgId: res.body.data.organization.id,
    adminId: res.body.data.user.id,
    adminToken: res.body.data.accessToken,
    adminEmail,
    refreshCookie: refreshCookieFrom(res),
  };
}

export async function login(email: string, password = PASSWORD): Promise<string> {
  const res = await api.post('/api/v1/auth/login').send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data.accessToken as string;
}

/** Logs in with a temporary password and completes the forced password change. */
export async function activate(email: string, temporaryPassword = PASSWORD): Promise<string> {
  const token = await login(email, temporaryPassword);
  const res = await as(token)
    .post('/api/v1/auth/change-password')
    .send({ currentPassword: temporaryPassword, newPassword: `${temporaryPassword}-new` });
  expect(res.status, JSON.stringify(res.body)).toBe(204);
  return token;
}

export async function createManager(adminToken: string) {
  const email = uniqueEmail('manager');
  const res = await as(adminToken)
    .post('/api/v1/users')
    .send({ name: 'Team Manager', email, role: 'manager', temporaryPassword: PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const token = await activate(email);
  return { id: res.body.data.id as string, email, token };
}

export async function createTeam(adminToken: string, name: string, managerIds: string[] = []) {
  const res = await as(adminToken).post('/api/v1/teams').send({ name, managerIds });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}

export async function createAgent(token: string, teamId: string | null, extra: object = {}) {
  const email = uniqueEmail('agent');
  const res = await as(token)
    .post('/api/v1/agents')
    .send({ name: 'Field Agent', email, temporaryPassword: PASSWORD, teamId, ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { id: res.body.data.id as string, userId: res.body.data.userId as string, email };
}

export async function createLocation(token: string, extra: object = {}) {
  const res = await as(token)
    .post('/api/v1/locations')
    .send({ name: 'Client HQ', position: { lat: 12.9716, lng: 77.5946 }, ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}
