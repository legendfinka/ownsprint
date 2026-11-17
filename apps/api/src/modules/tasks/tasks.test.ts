import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ErrorResponse, Page, Task, TaskDetail } from '@ownsprint/shared';
import { createApp } from '../../app';
import { auth, createProject, createSprint, createTask, registerUser } from '../../../test/helpers';

const app = createApp();

// An owner and a member sharing one project.
async function setup() {
  const owner = await registerUser(app, { email: 'owner@example.com' });
  const member = await registerUser(app, { email: 'member@example.com' });
  const project = await createProject(app, owner.token);
  await request(app)
    .post(`/api/projects/${project.id}/members`)
    .set(auth(owner.token))
    .send({ email: 'member@example.com' })
    .expect(201);

  const { token } = owner;
  const url = `/api/projects/${project.id}/tasks`;
  return { token, owner, member, project, url };
}

// The `fieldErrors` of a 400 response, e.g. { assigneeId: ['...'] }.
const fieldErrors = (res: request.Response) =>
  ((res.body as ErrorResponse).error.details as { body: { fieldErrors: object } }).body.fieldErrors;

describe('creating and editing tasks', () => {
  it('creates a task with defaults at the bottom of its column', async () => {
    const { token, project } = await setup();

    const first = await createTask(app, token, project.id, { title: '  First  ' });
    const second = await createTask(app, token, project.id);

    expect(first).toMatchObject({
      title: 'First',
      description: '',
      status: 'todo',
      priority: 'medium',
      estimate: null,
      assigneeId: null,
      sprintId: null,
      parentId: null,
    });
    expect(second.position).toBeGreaterThan(first.position);
  });

  it('updates fields, and null clears them', async () => {
    const { token, member, project, url } = await setup();
    const task = await createTask(app, token, project.id, {
      assigneeId: member.body.user.id,
      estimate: 3,
    });

    const res = await request(app)
      .patch(`${url}/${task.id}`)
      .set(auth(token))
      .send({ status: 'in_progress', priority: 'high', assigneeId: null })
      .expect(200);

    expect(res.body as Task).toMatchObject({
      status: 'in_progress',
      priority: 'high',
      assigneeId: null,
      estimate: 3, // not sent, so unchanged
    });
  });

  it('takes the subtasks along when a task changes sprint', async () => {
    const { token, project, url } = await setup();
    const sprint = await createSprint(app, token, project.id);
    const task = await createTask(app, token, project.id);
    await createTask(app, token, project.id, { parentId: task.id });

    await request(app).patch(`${url}/${task.id}`).set(auth(token)).send({ sprintId: sprint.id });
    const inSprint = await request(app).get(`${url}/${task.id}`).set(auth(token));
    expect((inSprint.body as TaskDetail).subtasks.map((s) => s.sprintId)).toEqual([sprint.id]);

    await request(app).patch(`${url}/${task.id}`).set(auth(token)).send({ sprintId: null });
    const backlog = await request(app).get(`${url}/${task.id}`).set(auth(token));
    expect((backlog.body as TaskDetail).subtasks.map((s) => s.sprintId)).toEqual([null]);
  });

  it('rejects an empty update', async () => {
    const { token, project, url } = await setup();
    const task = await createTask(app, token, project.id);
    await request(app).patch(`${url}/${task.id}`).set(auth(token)).send({}).expect(400);
  });

  it('deletes subtasks together with their parent', async () => {
    const { token, project, url } = await setup();
    const parent = await createTask(app, token, project.id, { title: 'Parent' });
    const child = await createTask(app, token, project.id, { parentId: parent.id });

    const res = await request(app).get(`${url}/${parent.id}`).set(auth(token)).expect(200);
    expect((res.body as TaskDetail).subtasks.map((t) => t.id)).toEqual([child.id]);

    await request(app).delete(`${url}/${parent.id}`).set(auth(token)).expect(204);
    await request(app).get(`${url}/${child.id}`).set(auth(token)).expect(404);
  });
});

describe('task references', () => {
  it('only accepts ids that belong to this project', async () => {
    const { token, url } = await setup();
    const stranger = await registerUser(app, { email: 'stranger@example.com' });
    const other = await createProject(app, token, 'Other');
    const otherSprint = await createSprint(app, token, other.id);
    const otherTask = await createTask(app, token, other.id);

    const res = await request(app)
      .post(url)
      .set(auth(token))
      .send({
        title: 'Bad refs',
        assigneeId: stranger.body.user.id,
        sprintId: otherSprint.id,
        parentId: otherTask.id,
      })
      .expect(400);

    expect(Object.keys(fieldErrors(res))).toEqual(['assigneeId', 'sprintId', 'parentId']);
  });

  it('allows only one level of subtasks', async () => {
    const { token, project, url } = await setup();
    const parent = await createTask(app, token, project.id);
    const child = await createTask(app, token, project.id, { parentId: parent.id });

    const res = await request(app)
      .post(url)
      .set(auth(token))
      .send({ title: 'Grandchild', parentId: child.id })
      .expect(400);
    expect(fieldErrors(res)).toHaveProperty('parentId');
  });

  it('returns 404 for a task from another project, even in your own project url', async () => {
    const { token, url } = await setup();
    const other = await createProject(app, token, 'Other');
    const otherTask = await createTask(app, token, other.id);

    await request(app).get(`${url}/${otherTask.id}`).set(auth(token)).expect(404);
    await request(app).delete(`${url}/${otherTask.id}`).set(auth(token)).expect(404);
  });

  it('hides tasks from outsiders', async () => {
    const { url } = await setup();
    const outsider = await registerUser(app, { email: 'outsider@example.com' });
    await request(app).get(url).set(auth(outsider.token)).expect(404);
  });
});

describe('searching tasks', () => {
  // Five tasks with different fields, to filter on.
  async function seed() {
    const ctx = await setup();
    const { token, member, project } = ctx;
    const sprint = await createSprint(app, token, project.id);
    const memberId = member.body.user.id;

    await createTask(app, token, project.id, {
      title: 'Login page',
      priority: 'high',
      sprintId: sprint.id,
    });
    await createTask(app, token, project.id, {
      title: 'Signup page',
      assigneeId: memberId,
      sprintId: sprint.id,
    });
    await createTask(app, token, project.id, {
      title: 'Fix logout',
      priority: 'high',
      assigneeId: memberId,
    });
    await createTask(app, token, project.id, { title: 'Docs', description: 'Explain LOGIN flow' });
    const done = await createTask(app, token, project.id, { title: 'Old task' });
    await request(app)
      .patch(`${ctx.url}/${done.id}`)
      .set(auth(token))
      .send({ status: 'done' })
      .expect(200);

    // Returns the titles found for a query string, sorted for easy comparison.
    const titles = async (query: string) => {
      const res = await request(app).get(`${ctx.url}?${query}`).set(auth(token)).expect(200);
      return (res.body as Page<Task>).items.map((t) => t.title).sort();
    };
    return { ...ctx, sprint, memberId, titles };
  }

  it('filters by status, priority, assignee and sprint', async () => {
    const { sprint, memberId, titles } = await seed();

    expect(await titles('status=done')).toEqual(['Old task']);
    expect(await titles('priority=high')).toEqual(['Fix logout', 'Login page']);
    expect(await titles(`assigneeId=${memberId}`)).toEqual(['Fix logout', 'Signup page']);
    expect(await titles(`sprintId=${sprint.id}`)).toEqual(['Login page', 'Signup page']);
    expect(await titles('sprintId=backlog')).toEqual(['Docs', 'Fix logout', 'Old task']);
  });

  it('combines filters', async () => {
    const { memberId, titles } = await seed();
    expect(await titles(`priority=high&assigneeId=${memberId}`)).toEqual(['Fix logout']);
  });

  it('searches title and description, ignoring case', async () => {
    const { titles } = await seed();
    expect(await titles('q=login')).toEqual(['Docs', 'Login page']);
  });

  it('pages through results with a total count', async () => {
    const { token, url } = await seed();

    const res = await request(app).get(`${url}?page=3&pageSize=2`).set(auth(token)).expect(200);

    const page = res.body as Page<Task>;
    expect(page).toMatchObject({ total: 5, page: 3, pageSize: 2 });
    expect(page.items).toHaveLength(1);
  });

  it('rejects invalid query values', async () => {
    const { token, url } = await setup();
    await request(app).get(`${url}?pageSize=1000`).set(auth(token)).expect(400);
    await request(app).get(`${url}?status=unknown`).set(auth(token)).expect(400);
  });
});
