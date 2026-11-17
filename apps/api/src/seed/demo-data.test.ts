import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { AuthResponse, BoardResponse, ProjectListResponse, Sprint } from '@ownsprint/shared';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { auth, registerUser } from '../../test/helpers';
import { SEED_ACCOUNT, seedDemo } from './demo-data';

const app = createApp();

async function startDemo() {
  const res = await request(app).post('/api/auth/demo').expect(201);
  return res.body as AuthResponse;
}

async function projectsOf(token: string) {
  const res = await request(app).get('/api/projects').set(auth(token)).expect(200);
  return (res.body as ProjectListResponse).projects;
}

describe('try demo account', () => {
  it('signs a visitor in to a fresh sample project they own', async () => {
    const { user, accessToken } = await startDemo();
    expect(user.email).toMatch(/@demo\.ownsprint\.dev$/);

    const [project] = await projectsOf(accessToken);
    expect(project?.role).toBe('owner'); // so the visitor can complete sprints

    const url = `/api/projects/${project?.id}/sprints`;
    const { sprints } = (await request(app).get(url).set(auth(accessToken))).body as {
      sprints: Sprint[];
    };
    expect(sprints.map((s) => s.status)).toEqual(['completed', 'active', 'planned']);

    const active = sprints.find((s) => s.status === 'active');
    const board = await request(app).get(`${url}/${active?.id}/board`).set(auth(accessToken));
    const tasks = (board.body as BoardResponse).tasks;
    expect(new Set(tasks.map((t) => t.status))).toEqual(new Set(['todo', 'in_progress', 'done']));
    expect(tasks.some((t) => t.subtaskCount.total > 0)).toBe(true);
  });

  it('gives each visitor their own copy', async () => {
    const first = await startDemo();
    const second = await startDemo();

    const [a] = await projectsOf(first.accessToken);
    const [b] = await projectsOf(second.accessToken);
    expect(a?.id).not.toBe(b?.id);
    await request(app).get(`/api/projects/${a?.id}`).set(auth(second.accessToken)).expect(404);
  });

  it('deletes demo accounts older than a day, and nothing else', async () => {
    const old = await startDemo();
    const real = await registerUser(app);
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.user.updateMany({ data: { createdAt: dayAgo } }); // everyone is "old" now

    await startDemo();

    expect(await prisma.user.findUnique({ where: { id: old.user.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: real.body.user.id } })).not.toBeNull();
  });

  it('keeps visitors from taking over a demo login', async () => {
    const { accessToken } = await startDemo();

    await request(app)
      .patch('/api/auth/me/password')
      .set(auth(accessToken))
      .send({ currentPassword: 'anything', newPassword: 'a-new-password' })
      .expect(403);
    await request(app)
      .patch('/api/auth/me/email')
      .set(auth(accessToken))
      .send({ email: 'mine@example.com', currentPassword: 'anything' })
      .expect(403);
  });

  it('keeps the demo domain for demo accounts', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'me@demo.ownsprint.dev',
        password: 'a-strong-password',
        firstName: 'Me',
        lastName: '',
      })
      .expect(400);

    const { token, input } = await registerUser(app);
    await request(app)
      .patch('/api/auth/me/email')
      .set(auth(token))
      .send({ email: 'me@demo.ownsprint.dev', currentPassword: input.password })
      .expect(400);
  });
});

describe('seed script', () => {
  const login = () =>
    request(app)
      .post('/api/auth/login')
      .send({ email: SEED_ACCOUNT.email, password: SEED_ACCOUNT.password });

  it('creates a fixed demo login', async () => {
    await seedDemo();
    const token = ((await login().expect(200)).body as AuthResponse).accessToken;
    expect(await projectsOf(token)).toHaveLength(1);
  });

  it('can run again: it resets the data instead of duplicating it', async () => {
    await seedDemo();
    const counts = () =>
      Promise.all([prisma.user.count(), prisma.project.count(), prisma.task.count()]);
    const first = await counts();

    await prisma.task.deleteMany(); // a visitor makes a mess
    await seedDemo();

    expect(await counts()).toEqual(first);
  });
});
