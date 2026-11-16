import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ErrorResponse, Sprint, SprintListResponse, TaskDetail } from '@ownsprint/shared';
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

  it('allows only one active sprint per project', async () => {
    const { token, project, url } = await setup();
    const a = await createSprint(app, token, project.id, { name: 'A' });
    const b = await createSprint(app, token, project.id, { name: 'B' });
    const setStatus = (id: string, status: string) =>
      request(app).patch(`${url}/${id}`).set(auth(token)).send({ status });

    expect(((await setStatus(a.id, 'active').expect(200)).body as Sprint).status).toBe('active');
    expect(errorCode(await setStatus(b.id, 'active').expect(409))).toBe('CONFLICT');

    await setStatus(a.id, 'completed').expect(200);
    await setStatus(b.id, 'active').expect(200);
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
