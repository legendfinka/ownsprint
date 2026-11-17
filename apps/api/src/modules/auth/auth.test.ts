import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AuthResponse, ErrorResponse, MeResponse, RefreshResponse } from '@ownsprint/shared';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { getRefreshCookie, getRefreshSetCookie, registerUser } from '../../../test/helpers';

const app = createApp();
const errorCode = (res: request.Response) => (res.body as ErrorResponse).error.code;

describe('POST /auth/register', () => {
  it('creates a user and sets a secure refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: ' Alice@Example.COM ',
        password: 'correct-horse',
        firstName: ' Alice ',
        lastName: ' Lee ',
      })
      .expect(201);

    const body = res.body as AuthResponse;
    expect(body.user).toMatchObject({
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Lee',
      name: 'Alice Lee',
      avatarColor: null,
      avatarEmoji: null,
    });
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.accessToken).toEqual(expect.any(String));

    const cookie = getRefreshSetCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate email, ignoring letter case', async () => {
    await registerUser(app, { email: 'bob@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'BOB@example.com',
        password: 'another-password',
        firstName: 'Bob',
        lastName: '',
      })
      .expect(409);

    expect(errorCode(res)).toBe('CONFLICT');
  });

  it('returns field errors for invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', firstName: '', lastName: '' })
      .expect(400);

    const { error } = res.body as ErrorResponse;
    expect(error.code).toBe('VALIDATION_ERROR');
    const { fieldErrors } = (error.details as { body: { fieldErrors: object } }).body;
    expect(Object.keys(fieldErrors)).toEqual(
      expect.arrayContaining(['email', 'password', 'firstName']),
    );
  });
});

describe('POST /auth/login', () => {
  it('logs in with the right password', async () => {
    const { input } = await registerUser(app);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: input.email.toUpperCase(), password: input.password })
      .expect(200);

    expect((res.body as AuthResponse).user.email).toBe(input.email);
    expect(getRefreshCookie(res)).toMatch(/^refresh_token=/);
  });

  it('answers the same for a wrong password and an unknown email', async () => {
    const { input } = await registerUser(app);
    const login = (email: string) =>
      request(app).post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);

    const wrongPassword = await login(input.email);
    const unknownEmail = await login('nobody@example.com');

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(getRefreshSetCookie(wrongPassword)).toBeUndefined();
  });
});

describe('POST /auth/refresh', () => {
  const refresh = (cookie?: string) => {
    const req = request(app).post('/api/auth/refresh');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  it('gives a new access token and a new refresh token', async () => {
    const { refreshCookie } = await registerUser(app);

    const res = await refresh(refreshCookie).expect(200);

    expect((res.body as RefreshResponse).accessToken).toEqual(expect.any(String));
    const newCookie = getRefreshCookie(res);
    expect(newCookie).not.toBe(refreshCookie);
    await refresh(newCookie).expect(200);
  });

  it('logs the user out everywhere when an old token is reused', async () => {
    const { refreshCookie: oldCookie } = await registerUser(app);
    const newCookie = getRefreshCookie(await refresh(oldCookie).expect(200));

    await refresh(oldCookie).expect(401); // reuse = probably stolen
    await refresh(newCookie).expect(401); // so the new one is revoked too
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('rejects a missing, unknown or expired token', async () => {
    const { refreshCookie } = await registerUser(app);
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    expect(errorCode(await refresh().expect(401))).toBe('UNAUTHORIZED');
    await refresh('refresh_token=made-up').expect(401);
    await refresh(refreshCookie).expect(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the token and clears the cookie', async () => {
    const { refreshCookie } = await registerUser(app);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshCookie)
      .expect(204);

    expect(getRefreshSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/i); // deletes the cookie
    await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie).expect(401);
  });

  it('works without a cookie too', async () => {
    await request(app).post('/api/auth/logout').expect(204);
  });
});

describe('GET /auth/me', () => {
  const me = (token: string) =>
    request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  const sign = (userId: string, secret: string, expiresAt: number) =>
    new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(secret));
  const now = () => Math.floor(Date.now() / 1000);

  it('returns the current user', async () => {
    const { body } = await registerUser(app);
    const res = await me(body.accessToken).expect(200);
    expect((res.body as MeResponse).user).toEqual(body.user);
  });

  it('rejects missing and malformed tokens', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await me('not-a-jwt').expect(401);
  });

  it('rejects an expired token', async () => {
    const { body } = await registerUser(app);
    await me(await sign(body.user.id, env.JWT_ACCESS_SECRET, now() - 60)).expect(401);
  });

  it('rejects a token signed with another secret', async () => {
    const { body } = await registerUser(app);
    const forged = await sign(body.user.id, 'an-attacker-secret-that-is-long-enough', now() + 60);
    await me(forged).expect(401);
  });
});

describe('account settings', () => {
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (email: string, password: string) =>
    request(app).post('/api/auth/login').send({ email, password });

  it('updates the name and avatar, and clears the emoji', async () => {
    const { token } = await registerUser(app);
    const patch = (body: object) => request(app).patch('/api/auth/me').set(as(token)).send(body);

    const res = await patch({
      firstName: ' Ann ',
      lastName: 'Lee',
      avatarColor: '#a8c3a0',
      avatarEmoji: '🦊',
    }).expect(200);
    expect((res.body as MeResponse).user).toMatchObject({
      name: 'Ann Lee',
      avatarColor: '#a8c3a0',
      avatarEmoji: '🦊',
    });

    const cleared = await patch({
      firstName: 'Ann',
      lastName: '',
      avatarColor: '#a8c3a0',
      avatarEmoji: null,
    }).expect(200);
    expect((cleared.body as MeResponse).user).toMatchObject({ name: 'Ann', avatarEmoji: null });
  });

  it('only accepts avatars from the lists', async () => {
    const { token } = await registerUser(app);
    const profile = { firstName: 'Ann', lastName: '', avatarColor: null, avatarEmoji: null };
    const patch = (body: object) => request(app).patch('/api/auth/me').set(as(token)).send(body);

    await patch({ ...profile, avatarColor: '#ff0000' }).expect(400);
    await patch({ ...profile, avatarEmoji: 'hello' }).expect(400);
    await patch({ ...profile, firstName: ' ' }).expect(400);
  });

  it('requires login', async () => {
    await request(app).patch('/api/auth/me').send({}).expect(401);
    await request(app).patch('/api/auth/me/email').send({}).expect(401);
    await request(app).patch('/api/auth/me/password').send({}).expect(401);
  });

  it('changes the email with the current password', async () => {
    const { token, input } = await registerUser(app);
    const change = (email: string, currentPassword: string) =>
      request(app).patch('/api/auth/me/email').set(as(token)).send({ email, currentPassword });

    const res = await change(' New@Example.com ', input.password).expect(200);
    expect((res.body as MeResponse).user.email).toBe('new@example.com');
    await login('new@example.com', input.password).expect(200);
    await login(input.email, input.password).expect(401);
  });

  it('refuses a new email with a wrong password or one already taken', async () => {
    await registerUser(app, { email: 'taken@example.com' });
    const { token, input } = await registerUser(app, { email: 'me@example.com' });
    const change = (email: string, currentPassword: string) =>
      request(app).patch('/api/auth/me/email').set(as(token)).send({ email, currentPassword });

    const wrong = await change('new@example.com', 'not-my-password').expect(400);
    expect(JSON.stringify((wrong.body as ErrorResponse).error.details)).toContain(
      'currentPassword',
    );
    expect(errorCode(await change('TAKEN@example.com', input.password).expect(409))).toBe(
      'CONFLICT',
    );
  });

  it('changes the password and signs out the other sessions only', async () => {
    const { token, input, refreshCookie } = await registerUser(app);
    const otherDevice = getRefreshCookie(await login(input.email, input.password).expect(200));

    await request(app)
      .patch('/api/auth/me/password')
      .set(as(token))
      .set('Cookie', refreshCookie)
      .send({ currentPassword: input.password, newPassword: 'a-brand-new-password' })
      .expect(204);

    await login(input.email, input.password).expect(401);
    await login(input.email, 'a-brand-new-password').expect(200);
    // Order matters: a revoked token coming back counts as theft and ends all sessions.
    await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie).expect(200);
    await request(app).post('/api/auth/refresh').set('Cookie', otherDevice).expect(401);
  });

  it('refuses a new password when the current one is wrong', async () => {
    const { token, input } = await registerUser(app);

    await request(app)
      .patch('/api/auth/me/password')
      .set(as(token))
      .send({ currentPassword: 'nope-nope', newPassword: 'a-brand-new-password' })
      .expect(400);

    await login(input.email, input.password).expect(200); // unchanged
  });
});

describe('rate limiting', () => {
  it('returns 429 after too many login attempts', async () => {
    const limitedApp = createApp({ authRateLimitMax: 2 });
    const attempt = () =>
      request(limitedApp)
        .post('/api/auth/login')
        .send({ email: 'a@example.com', password: 'guess' });

    await attempt().expect(401);
    await attempt().expect(401);
    expect(errorCode(await attempt().expect(429))).toBe('RATE_LIMITED');
  });
});
