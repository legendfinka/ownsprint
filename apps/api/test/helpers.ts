import type { Express } from 'express';
import request, { type Response } from 'supertest';
import type { AuthResponse, ProjectSummary, RegisterInput, Sprint, Task } from '@ownsprint/shared';

// Header for an authenticated request: `.set(auth(token))`.
export function auth(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

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
  const res = await request(app).post('/api/auth/register').send(input).expect(201);
  const body = res.body as AuthResponse;
  return { input, body, token: body.accessToken, refreshCookie: getRefreshCookie(res) };
}

export async function createProject(app: Express, token: string, name = 'Test Project') {
  const res = await request(app).post('/api/projects').set(auth(token)).send({ name }).expect(201);
  return res.body as ProjectSummary;
}

export async function createSprint(
  app: Express,
  token: string,
  projectId: string,
  body: object = {},
) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/sprints`)
    .set(auth(token))
    .send({ name: 'Sprint 1', startDate: '2026-11-16', endDate: '2026-11-29', ...body })
    .expect(201);
  return res.body as Sprint;
}

export async function createTask(
  app: Express,
  token: string,
  projectId: string,
  body: object = {},
) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/tasks`)
    .set(auth(token))
    .send({ title: 'A task', ...body })
    .expect(201);
  return res.body as Task;
}
