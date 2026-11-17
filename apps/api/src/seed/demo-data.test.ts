import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  DEMO_ACCOUNT,
  type AuthResponse,
  type BoardResponse,
  type Sprint,
} from '@ownsprint/shared';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { auth } from '../../test/helpers';
import { seedDemo } from './demo-data';

const app = createApp();

async function loginAsDemo() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password })
    .expect(200);
  return (res.body as AuthResponse).accessToken;
}

describe('demo data', () => {
  it('creates a demo project you can log in to and use', async () => {
    await seedDemo(prisma);
    const token = await loginAsDemo();

    const projects = await request(app).get('/api/projects').set(auth(token)).expect(200);
    const [project] = (projects.body as { projects: { id: string; role: string }[] }).projects;
    expect(project?.role).toBe('owner'); // so the demo can complete sprints

    const url = `/api/projects/${project?.id}/sprints`;
    const { sprints } = (await request(app).get(url).set(auth(token))).body as {
      sprints: Sprint[];
    };
    expect(sprints.map((s) => s.status)).toEqual(['completed', 'active', 'planned']);

    const active = sprints.find((s) => s.status === 'active');
    const board = await request(app).get(`${url}/${active?.id}/board`).set(auth(token));
    const tasks = (board.body as BoardResponse).tasks;
    expect(new Set(tasks.map((t) => t.status))).toEqual(new Set(['todo', 'in_progress', 'done']));
    expect(tasks.some((t) => t.subtaskCount.total > 0)).toBe(true);
  });

  it('can run again: it resets the demo data instead of duplicating it', async () => {
    await seedDemo(prisma);
    const counts = () =>
      Promise.all([prisma.user.count(), prisma.project.count(), prisma.task.count()]);
    const first = await counts();

    // The visitor makes a mess, then the seed runs again.
    await prisma.task.deleteMany();
    await seedDemo(prisma);

    expect(await counts()).toEqual(first);
  });

  it('keeps visitors from changing the demo login', async () => {
    await seedDemo(prisma);
    const token = await loginAsDemo();

    await request(app)
      .patch('/api/auth/me/password')
      .set(auth(token))
      .send({ currentPassword: DEMO_ACCOUNT.password, newPassword: 'locked-out-for-everyone' })
      .expect(403);
    await request(app)
      .patch('/api/auth/me/email')
      .set(auth(token))
      .send({ email: 'hijacked@example.com', currentPassword: DEMO_ACCOUNT.password })
      .expect(403);
    await loginAsDemo(); // still works
  });
});
