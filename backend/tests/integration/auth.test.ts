import { describe, expect, it } from 'vitest';
import {
  PASSWORD,
  api,
  as,
  createManager,
  login,
  refreshCookieFrom,
  registerOrg,
  uniqueEmail,
} from '../helpers/api.js';

describe('auth: register & login', () => {
  it('registers an organization with its first admin and sets a hardened refresh cookie', async () => {
    const email = uniqueEmail('founder');
    const res = await api.post('/api/v1/auth/register').send({
      organizationName: 'Swift Couriers',
      timezone: 'Asia/Kolkata',
      name: 'Founder',
      email: email.toUpperCase(),
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ role: 'admin', email, status: 'active' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.organization).toMatchObject({
      name: 'Swift Couriers',
      timezone: 'Asia/Kolkata',
    });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.expiresIn).toBe(900);

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('ft_refresh='),
    )!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects duplicate emails with 409 CONFLICT', async () => {
    const { adminEmail } = await registerOrg();
    const res = await api.post('/api/v1/auth/register').send({
      organizationName: 'Other',
      name: 'Someone',
      email: adminEmail,
      password: PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns field-level validation details', async () => {
    const res = await api.post('/api/v1/auth/register').send({
      organizationName: '',
      name: 'x',
      email: 'not-an-email',
      password: 'short',
      timezone: 'Mars/Base',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = (res.body.error.details as { path: string }[]).map((d) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining(['organizationName', 'email', 'password', 'timezone']),
    );
  });

  it('rejects unknown body fields (strict schemas)', async () => {
    const res = await api
      .post('/api/v1/auth/login')
      .send({ email: 'a@example.test', password: 'x', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('uses the same error for unknown email and wrong password', async () => {
    const { adminEmail } = await registerOrg();
    const wrongPassword = await api
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'nope-nope-nope' });
    const unknownEmail = await api
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('ghost'), password: PASSWORD });
    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
  });

  it('GET /auth/me returns the user and organization', async () => {
    const { adminToken, adminEmail } = await registerOrg('Me Org');
    const res = await as(adminToken).get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(adminEmail);
    expect(res.body.data.organization.name).toBe('Me Org');
  });

  it('rejects missing, malformed and tampered access tokens', async () => {
    const { adminToken } = await registerOrg();
    expect((await api.get('/api/v1/auth/me')).status).toBe(401);
    expect((await as('garbage').get('/api/v1/auth/me')).status).toBe(401);
    const tampered = `${adminToken.slice(0, -4)}AAAA`;
    const res = await as(tampered).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('auth: refresh rotation & logout', () => {
  it('rotates the refresh cookie and issues a working access token', async () => {
    const { refreshCookie } = await registerOrg();
    const res = await api.post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(200);
    const rotated = refreshCookieFrom(res);
    expect(rotated).not.toBe(refreshCookie);
    expect((await as(res.body.data.accessToken as string).get('/api/v1/auth/me')).status).toBe(200);
  });

  it('detects reuse of a rotated refresh token and revokes the whole session', async () => {
    const { refreshCookie, adminToken } = await registerOrg();
    const first = await api.post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    const rotated = refreshCookieFrom(first);

    // Replay the old token (e.g. stolen) -> rejected and the session family is revoked.
    const replay = await api.post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(replay.status).toBe(401);

    // The legitimate, newest token no longer works either, nor do access tokens of that session.
    expect((await api.post('/api/v1/auth/refresh').set('Cookie', rotated)).status).toBe(401);
    expect((await as(adminToken).get('/api/v1/auth/me')).status).toBe(401);
  });

  it('returns 401 when no refresh cookie is sent', async () => {
    const res = await api.post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('logout revokes the session immediately (refresh and access token)', async () => {
    const { refreshCookie, adminToken } = await registerOrg();
    const res = await api.post('/api/v1/auth/logout').set('Cookie', refreshCookie);
    expect(res.status).toBe(204);
    expect((await api.post('/api/v1/auth/refresh').set('Cookie', refreshCookie)).status).toBe(401);
    expect((await as(adminToken).get('/api/v1/auth/me')).status).toBe(401);
  });

  it('logout is idempotent without a cookie', async () => {
    expect((await api.post('/api/v1/auth/logout')).status).toBe(204);
  });

  it('logout-all revokes every session of the user', async () => {
    const { adminEmail, adminToken } = await registerOrg();
    const secondDevice = await login(adminEmail);
    expect((await as(adminToken).post('/api/v1/auth/logout-all')).status).toBe(204);
    expect((await as(secondDevice).get('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('auth: temporary passwords & account status', () => {
  it('forces a password change before other routes can be used', async () => {
    const { adminToken } = await registerOrg();
    const email = uniqueEmail('mgr');
    await as(adminToken)
      .post('/api/v1/users')
      .send({ name: 'New Manager', email, role: 'manager', temporaryPassword: PASSWORD });

    const token = await login(email);
    const me = await as(token).get('/api/v1/auth/me');
    expect(me.body.data.user.mustChangePassword).toBe(true);

    const blocked = await as(token).get('/api/v1/agents');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const wrong = await as(token)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'wrong-password', newPassword: 'brand-new-password-1' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const changed = await as(token)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'brand-new-password-1' });
    expect(changed.status).toBe(204);
    expect((await as(token).get('/api/v1/agents')).status).toBe(200);
    expect((await api.post('/api/v1/auth/login').send({ email, password: PASSWORD })).status).toBe(
      401,
    );
    await login(email, 'brand-new-password-1');
  });

  it('deactivation takes effect immediately for existing tokens', async () => {
    const { adminToken } = await registerOrg();
    const manager = await createManager(adminToken);
    expect((await as(manager.token).get('/api/v1/teams')).status).toBe(200);

    await as(adminToken).post(`/api/v1/users/${manager.id}/deactivate`).expect(200);
    expect((await as(manager.token).get('/api/v1/teams')).status).toBe(401);
    const relogin = await api
      .post('/api/v1/auth/login')
      .send({ email: manager.email, password: `${PASSWORD}-new` });
    expect(relogin.status).toBe(401);
  });

  it('role changes apply immediately without re-login', async () => {
    const { adminToken } = await registerOrg();
    const manager = await createManager(adminToken);
    expect((await as(manager.token).get('/api/v1/users')).status).toBe(403);
    await as(adminToken).patch(`/api/v1/users/${manager.id}`).send({ role: 'admin' }).expect(200);
    expect((await as(manager.token).get('/api/v1/users')).status).toBe(200);
  });
});
