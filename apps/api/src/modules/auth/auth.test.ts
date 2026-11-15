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
      .post('/auth/register')
      .send({ email: ' Alice@Example.COM ', password: 'correct-horse', name: ' Alice ' })
      .expect(201);

    const body = res.body as AuthResponse;
    expect(body.user).toMatchObject({ email: 'alice@example.com', name: 'Alice' });
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.accessToken).toEqual(expect.any(String));

    const cookie = getRefreshSetCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/auth/i);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate email, ignoring letter case', async () => {
    await registerUser(app, { email: 'bob@example.com' });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'BOB@example.com', password: 'another-password', name: 'Bob' })
      .expect(409);

    expect(errorCode(res)).toBe('CONFLICT');
  });

  it('returns field errors for invalid input', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' })
      .expect(400);

    const { error } = res.body as ErrorResponse;
    expect(error.code).toBe('VALIDATION_ERROR');
    const { fieldErrors } = (error.details as { body: { fieldErrors: object } }).body;
    expect(Object.keys(fieldErrors)).toEqual(expect.arrayContaining(['email', 'password', 'name']));
  });
});

describe('POST /auth/login', () => {
  it('logs in with the right password', async () => {
    const { input } = await registerUser(app);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: input.email.toUpperCase(), password: input.password })
      .expect(200);

    expect((res.body as AuthResponse).user.email).toBe(input.email);
    expect(getRefreshCookie(res)).toMatch(/^refresh_token=/);
  });

  it('answers the same for a wrong password and an unknown email', async () => {
    const { input } = await registerUser(app);
    const login = (email: string) =>
      request(app).post('/auth/login').send({ email, password: 'wrong-password' }).expect(401);

    const wrongPassword = await login(input.email);
    const unknownEmail = await login('nobody@example.com');

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(getRefreshSetCookie(wrongPassword)).toBeUndefined();
  });
});

describe('POST /auth/refresh', () => {
  const refresh = (cookie?: string) => {
    const req = request(app).post('/auth/refresh');
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

    const res = await request(app).post('/auth/logout').set('Cookie', refreshCookie).expect(204);

    expect(getRefreshSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/i); // deletes the cookie
    await request(app).post('/auth/refresh').set('Cookie', refreshCookie).expect(401);
  });

  it('works without a cookie too', async () => {
    await request(app).post('/auth/logout').expect(204);
  });
});

describe('GET /auth/me', () => {
  const me = (token: string) =>
    request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
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
    await request(app).get('/auth/me').expect(401);
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

describe('rate limiting', () => {
  it('returns 429 after too many login attempts', async () => {
    const limitedApp = createApp({ authRateLimitMax: 2 });
    const attempt = () =>
      request(limitedApp).post('/auth/login').send({ email: 'a@example.com', password: 'guess' });

    await attempt().expect(401);
    await attempt().expect(401);
    expect(errorCode(await attempt().expect(429))).toBe('RATE_LIMITED');
  });
});
