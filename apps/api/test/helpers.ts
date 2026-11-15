import type { Express } from 'express';
import request, { type Response } from 'supertest';
import type { AuthResponse, RegisterInput } from '@ownsprint/shared';

// Full Set-Cookie header of the refresh token, if the response set one.
export function getRefreshSetCookie(res: Response): string | undefined {
  const cookies: unknown = res.get('Set-Cookie');
  if (!Array.isArray(cookies)) return undefined;
  return cookies.find((c): c is string => typeof c === 'string' && c.startsWith('refresh_token='));
}

// Just "refresh_token=...", ready to send back in a Cookie header.
export function getRefreshCookie(res: Response): string {
  const setCookie = getRefreshSetCookie(res);
  if (!setCookie) throw new Error('No refresh cookie in response');
  return setCookie.split(';')[0] ?? '';
}

export async function registerUser(app: Express, overrides: Partial<RegisterInput> = {}) {
  const input: RegisterInput = {
    email: 'user@example.com',
    password: 'a-strong-password',
    name: 'Test User',
    ...overrides,
  };
  const res = await request(app).post('/auth/register').send(input).expect(201);
  return { input, body: res.body as AuthResponse, refreshCookie: getRefreshCookie(res) };
}
