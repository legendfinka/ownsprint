import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type {
  BoardResponse,
  ErrorResponse,
  Page,
  Sprint,
  SprintListResponse,
  Task,
  TaskDetail,
} from '@ownsprint/shared';
import { createApp } from '../../app';
import { auth, createProject, createSprint, createTask, registerUser } from '../../../test/helpers';

const app = createApp();
const errorCode = (res: request.Response) => (res.body as ErrorResponse).error.code;

async function setup() {
  const { token } = await registerUser(app);
  const project = await createProject(app, token);
  return { token, project, url: `/api/projects/${project.id}/sprints` };
}

describe('sprints', () => {
  it('creates sprints and lists them by start date', async () => {
    const { token, project, url } = await setup();
    await createSprint(app, token, project.id, {
      name: 'Later',
      startDate: '2026-12-01',
      endDate: '2026-12-14',
    });
    const first = await createSprint(app, token, project.id, { name: 'First' });

    expect(first).toMatchObject({
      name: 'First',
      startDate: '2026-11-16',
      endDate: '2026-11-29',
      status: 'planned',
    });

    const res = await request(app).get(url).set(auth(token)).expect(200);
    const names = (res.body as SprintListResponse).sprints.map((s) => s.name);
    expect(names).toEqual(['First', 'Later']);
  });

  it('rejects an end date before the start date, on create and on update', async () => {
    const { token, project, url } = await setup();

    const created = await request(app)
      .post(url)
      .set(auth(token))
      .send({ name: 'Bad', startDate: '2026-11-20', endDate: '2026-11-10' })
      .expect(400);
    expect(errorCode(created)).toBe('VALIDATION_ERROR');

    // Only the start date is sent, but it would end up after the stored end date.
    const sprint = await createSprint(app, token, project.id);
    await request(app)
      .patch(`${url}/${sprint.id}`)
      .set(auth(token))
      .send({ startDate: '2026-12-31' })
      .expect(400);
  });

  it('starts a sprint, one active sprint per project', async () => {
    const { token, project, url } = await setup();
    const a = await createSprint(app, token, project.id, { name: 'A' });
    const b = await createSprint(app, token, project.id, { name: 'B' });
    const start = (id: string) => request(app).post(`${url}/${id}/start`).set(auth(token));

    expect(((await start(a.id).expect(200)).body as Sprint).status).toBe('active');

    const second = await start(b.id).expect(409);
    expect(errorCode(second)).toBe('CONFLICT');
    expect((second.body as ErrorResponse).error.message).toContain('"A"');
    await start(a.id).expect(409); // already active

    await request(app)
      .post(`${url}/${a.id}/complete`)
      .set(auth(token))
      .send({ moveTo: null })
      .expect(200);
    await start(b.id).expect(200);
  });

  it('does not change the status through a plain update', async () => {
    const { token, project, url } = await setup();
    const sprint = await createSprint(app, token, project.id);

    await request(app)
      .patch(`${url}/${sprint.id}`)
      .set(auth(token))
      .send({ status: 'completed' })
      .expect(400);
  });

  describe('complete', () => {
    // An active sprint A and a planned sprint B, with some tasks in A.
    async function sprintWithTasks() {
      const { token, project, url } = await setup();
      const a = await createSprint(app, token, project.id, { name: 'A' });
      const b = await createSprint(app, token, project.id, { name: 'B' });
      const tasksUrl = `/api/projects/${project.id}/tasks`;
      const make = async (sprintId: string, title: string, status = 'todo') => {
        const task = await createTask(app, token, project.id, { sprintId, title });
        await request(app).patch(`${tasksUrl}/${task.id}`).set(auth(token)).send({ status });
        return task;
      };
      const complete = (moveTo: string | null) =>
        request(app).post(`${url}/${a.id}/complete`).set(auth(token)).send({ moveTo });
      const board = async (sprintId: string) =>
        (
          (await request(app).get(`${url}/${sprintId}/board`).set(auth(token)))
            .body as BoardResponse
        ).tasks;

      const open = await make(a.id, 'Open');
      const doing = await make(a.id, 'Doing', 'in_progress');
      await make(a.id, 'Finished', 'done');
      await make(b.id, 'Already there');
      await createTask(app, token, project.id, { sprintId: a.id, parentId: open.id, title: 'Sub' });
      await request(app).post(`${url}/${a.id}/start`).set(auth(token)).expect(200);

      return { token, project, url, a, b, open, doing, tasksUrl, complete, board };
    }

    it('moves unfinished tasks and their subtasks to the next sprint', async () => {
      const { token, a, b, open, tasksUrl, complete, board } = await sprintWithTasks();

      const res = await complete(b.id).expect(200);
      expect((res.body as Sprint).status).toBe('completed');

      expect((await board(a.id)).map((t) => t.title)).toEqual(['Finished']);
      const moved = await board(b.id);
      const titles = (status: string) =>
        moved.filter((t) => t.status === status).map((t) => t.title);
      expect(titles('todo')).toEqual(['Already there', 'Open']); // below the cards already there
      expect(titles('in_progress')).toEqual(['Doing']);

      const detail = await request(app).get(`${tasksUrl}/${open.id}`).set(auth(token));
      expect((detail.body as TaskDetail).subtasks.map((s) => s.sprintId)).toEqual([b.id]);
    });

    it('can send unfinished tasks to the backlog', async () => {
      const { token, open, tasksUrl, complete } = await sprintWithTasks();

      await complete(null).expect(200);

      const detail = await request(app).get(`${tasksUrl}/${open.id}`).set(auth(token));
      const task = detail.body as TaskDetail;
      expect(task.sprintId).toBeNull();
      expect(task.subtasks.map((s) => s.sprintId)).toEqual([null]);
    });

    it('is for the owner only', async () => {
      const { token, project, complete, a, url } = await sprintWithTasks();
      const member = await registerUser(app, { email: 'member@example.com' });
      await request(app)
        .post(`/api/projects/${project.id}/members`)
        .set(auth(token))
        .send({ email: 'member@example.com' })
        .expect(201);

      await request(app)
        .post(`${url}/${a.id}/complete`)
        .set(auth(member.token))
        .send({ moveTo: null })
        .expect(403);
      await complete(null).expect(200); // the owner can
    });

    it('needs an active sprint and a planned target', async () => {
      const { token, url, a, b, complete } = await sprintWithTasks();
      const other = await createProject(app, token, 'Other');
      const foreign = await createSprint(app, token, other.id);

      expect(errorCode(await complete(a.id).expect(400))).toBe('VALIDATION_ERROR'); // itself
      await complete(foreign.id).expect(400); // another project's sprint
      await complete(crypto.randomUUID()).expect(400);

      await complete(b.id).expect(200);
      await complete(b.id).expect(409); // already completed
      await request(app)
        .post(`${url}/${b.id}/complete`) // B is only planned
        .set(auth(token))
        .send({ moveTo: null })
        .expect(409);
    });

    it('lets only one of two simultaneous requests through', async () => {
      const { complete, b, board } = await sprintWithTasks();

      const results = await Promise.all([complete(b.id), complete(b.id)]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await board(b.id)).toHaveLength(3); // moved once, not twice
    });

    it('closes the sprint: no new, moved or dragged tasks', async () => {
      const { token, project, a, complete, tasksUrl } = await sprintWithTasks();
      const loose = await createTask(app, token, project.id, { title: 'Loose' });
      await complete(null).expect(200);

      await request(app)
        .post(tasksUrl)
        .set(auth(token))
        .send({ title: 'Late', sprintId: a.id })
        .expect(409);
      await request(app)
        .patch(`${tasksUrl}/${loose.id}`)
        .set(auth(token))
        .send({ sprintId: a.id })
        .expect(409);

      const page = await request(app).get(`${tasksUrl}?sprintId=${a.id}`).set(auth(token));
      const [finished] = (page.body as Page<Task>).items;
      await request(app)
        .post(`${tasksUrl}/${finished?.id}/move`)
        .set(auth(token))
        .send({ status: 'todo', afterId: null })
        .expect(409);
    });
  });

  it('moves tasks to the backlog when their sprint is deleted', async () => {
    const { token, project, url } = await setup();
    const sprint = await createSprint(app, token, project.id);
    const task = await createTask(app, token, project.id, { sprintId: sprint.id });

    await request(app).delete(`${url}/${sprint.id}`).set(auth(token)).expect(204);

    const res = await request(app)
      .get(`/api/projects/${project.id}/tasks/${task.id}`)
      .set(auth(token))
      .expect(200);
    expect((res.body as TaskDetail).sprintId).toBeNull();
  });

  it('hides sprints from outsiders and from other projects', async () => {
    const { token, project, url } = await setup();
    const sprint = await createSprint(app, token, project.id);
    const outsider = await registerUser(app, { email: 'outsider@example.com' });

    await request(app).get(url).set(auth(outsider.token)).expect(404);

    // The sprint exists, but not in this other project.
    const other = await createProject(app, token, 'Other');
    await request(app)
      .patch(`/api/projects/${other.id}/sprints/${sprint.id}`)
      .set(auth(token))
      .send({ name: 'Moved?' })
      .expect(404);
  });
});
