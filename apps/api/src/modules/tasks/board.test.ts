import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { BoardResponse, ErrorResponse, TaskStatus } from '@ownsprint/shared';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { auth, createProject, createSprint, createTask, registerUser } from '../../../test/helpers';

const app = createApp();

// A sprint with three cards in To Do: A, B, C.
async function setup() {
  const { token } = await registerUser(app);
  const project = await createProject(app, token);
  const sprint = await createSprint(app, token, project.id);
  const card = (title: string) =>
    createTask(app, token, project.id, { title, sprintId: sprint.id });
  const a = await card('A');
  const b = await card('B');
  const c = await card('C');

  const boardUrl = `/api/projects/${project.id}/sprints/${sprint.id}/board`;
  const move = (taskId: string, status: TaskStatus, afterId: string | null) =>
    request(app)
      .post(`/api/projects/${project.id}/tasks/${taskId}/move`)
      .set(auth(token))
      .send({ status, afterId });

  // Card titles per column, in board order.
  const columns = async () => {
    const res = await request(app).get(boardUrl).set(auth(token)).expect(200);
    const result: Record<string, string[]> = {};
    for (const task of (res.body as BoardResponse).tasks) {
      (result[task.status] ??= []).push(task.title);
    }
    return result;
  };

  return { token, project, sprint, a, b, c, boardUrl, move, columns };
}

describe('board', () => {
  it("lists only the sprint's top-level tasks, by position", async () => {
    const { token, project, a, columns } = await setup();
    await createTask(app, token, project.id, { title: 'Backlog' });
    await createTask(app, token, project.id, { title: 'Subtask', parentId: a.id });

    expect(await columns()).toEqual({ todo: ['A', 'B', 'C'] });
  });

  it('counts done and total subtasks per card', async () => {
    const { token, project, a, boardUrl } = await setup();
    await createTask(app, token, project.id, { title: 'One', parentId: a.id });
    const two = await createTask(app, token, project.id, { title: 'Two', parentId: a.id });
    await request(app)
      .patch(`/api/projects/${project.id}/tasks/${two.id}`)
      .set(auth(token))
      .send({ status: 'done' })
      .expect(200);

    const res = await request(app).get(boardUrl).set(auth(token)).expect(200);
    const counts = (res.body as BoardResponse).tasks.map((t) => [t.title, t.subtaskCount]);
    expect(counts).toEqual([
      ['A', { done: 1, total: 2 }],
      ['B', { done: 0, total: 0 }],
      ['C', { done: 0, total: 0 }],
    ]);
  });

  it('hides the board from non-members and 404s an unknown sprint', async () => {
    const { token, project, boardUrl } = await setup();
    const stranger = await registerUser(app, { email: 'stranger@example.com' });
    await request(app).get(boardUrl).set(auth(stranger.token)).expect(404);

    // A real sprint id, but from the stranger's own project.
    const strangerProject = await createProject(app, stranger.token);
    const strangerSprint = await createSprint(app, stranger.token, strangerProject.id);
    await request(app)
      .get(`/api/projects/${project.id}/sprints/${strangerSprint.id}/board`)
      .set(auth(token))
      .expect(404);
  });
});

describe('moving cards', () => {
  it('reorders inside a column', async () => {
    const { a, c, move, columns } = await setup();

    await move(a.id, 'todo', c.id).expect(200); // B, C, A
    await move(c.id, 'todo', null).expect(200); // C, B, A

    expect(await columns()).toEqual({ todo: ['C', 'B', 'A'] });
  });

  it('moves a card to another column', async () => {
    const { a, b, move, columns } = await setup();

    const res = await move(b.id, 'in_progress', null).expect(200);
    await move(a.id, 'in_progress', b.id).expect(200);

    expect(res.body).toMatchObject({ status: 'in_progress' });
    expect(await columns()).toEqual({ todo: ['C'], in_progress: ['B', 'A'] });
  });

  it('rejects an afterId that is not in the target column', async () => {
    const { a, b, move } = await setup();

    // B is in To Do, not in Done.
    const res = await move(a.id, 'done', b.id).expect(400);
    const details = (res.body as ErrorResponse).error.details as { body: { fieldErrors: object } };
    expect(Object.keys(details.body.fieldErrors)).toEqual(['afterId']);

    // A card can't land below itself.
    await move(a.id, 'todo', a.id).expect(400);
  });

  it('renumbers the column when the gap between cards gets too small', async () => {
    const { a, b, c, move, columns } = await setup();
    await prisma.task.update({ where: { id: b.id }, data: { position: a.position + 1e-7 } });

    await move(c.id, 'todo', a.id).expect(200);

    expect(await columns()).toEqual({ todo: ['A', 'C', 'B'] });
    const positions = await prisma.task.findMany({
      where: { id: { in: [a.id, b.id, c.id] } },
      orderBy: { position: 'asc' },
      select: { position: true },
    });
    expect(positions.map((t) => t.position)).toEqual([1000, 1500, 2000]);
  });

  it('does not let non-members move cards', async () => {
    const { a, project } = await setup();
    const stranger = await registerUser(app, { email: 'stranger@example.com' });

    await request(app)
      .post(`/api/projects/${project.id}/tasks/${a.id}/move`)
      .set(auth(stranger.token))
      .send({ status: 'done', afterId: null })
      .expect(404);
  });
});
