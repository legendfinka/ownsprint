import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type {
  BreakdownSuggestion,
  DescriptionSuggestion,
  ErrorResponse,
  EstimateSuggestion,
  SubtaskListResponse,
  TaskDetail,
} from '@ownsprint/shared';
import { createApp } from '../../app';
import { auth, createProject, createTask, registerUser } from '../../../test/helpers';
import type { AiProvider, AiRequest } from './providers/ai-provider';

const validBreakdown = JSON.stringify({
  subtasks: [
    { title: 'Design the schema', priority: 'high', estimate: 2 },
    { title: 'Build the endpoint', priority: 'medium', estimate: 3 },
  ],
});

// Answers with the given replies in order; an Error reply is thrown.
function scriptedAi(...replies: (string | Error)[]) {
  const calls: AiRequest[] = [];
  const provider: AiProvider = {
    name: 'scripted',
    complete(req) {
      calls.push(req);
      const reply = replies.shift() ?? 'out of replies';
      return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
    },
  };
  return { provider, calls };
}

async function setup(options: Parameters<typeof createApp>[0] = {}) {
  const app = createApp(options);
  const { token } = await registerUser(app);
  const project = await createProject(app, token);
  const task = await createTask(app, token, project.id, { title: 'Add CSV export' });
  const taskUrl = `/api/projects/${project.id}/tasks/${task.id}`;
  const ask = (what: 'breakdown' | 'estimate' | 'description', as = token) =>
    request(app).post(`${taskUrl}/ai/${what}`).set(auth(as));
  return { app, token, project, task, taskUrl, ask };
}

const errorCode = (res: request.Response) => (res.body as ErrorResponse).error.code;

describe('AI suggestions', () => {
  it('suggests a breakdown with the mock provider and saves nothing', async () => {
    const { app, token, taskUrl, ask } = await setup(); // no key in tests: mock

    const res = await ask('breakdown').expect(200);

    expect((res.body as BreakdownSuggestion).subtasks.length).toBeGreaterThanOrEqual(2);
    const detail = await request(app).get(taskUrl).set(auth(token)).expect(200);
    expect((detail.body as TaskDetail).subtasks).toEqual([]);
  });

  it('suggests an estimate with points from the planning scale', async () => {
    const { ask } = await setup();

    const res = await ask('estimate').expect(200);

    expect(res.body).toMatchObject({ priority: 'medium' });
    expect([1, 2, 3, 5, 8, 13]).toContain((res.body as EstimateSuggestion).estimate);
  });

  it('writes a description without saving it', async () => {
    const { app, token, taskUrl, ask } = await setup();

    const res = await ask('description').expect(200);

    expect((res.body as DescriptionSuggestion).description).toContain('Done when:');
    const detail = await request(app).get(taskUrl).set(auth(token)).expect(200);
    expect((detail.body as TaskDetail).description).toBe('');
  });

  it('rejects a breakdown without a priority per subtask', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const noPriority = JSON.stringify({
      subtasks: [
        { title: 'One', estimate: 1 },
        { title: 'Two', estimate: 2 },
      ],
    });
    const { provider } = scriptedAi(noPriority, noPriority);
    const { ask } = await setup({ ai: provider });

    await ask('breakdown').expect(502);
  });

  it('sends the task to the model, marked as data', async () => {
    const { provider, calls } = scriptedAi(validBreakdown);
    const { ask } = await setup({ ai: provider });

    await ask('breakdown').expect(200);

    expect(calls[0]?.prompt).toContain('<title>Add CSV export</title>');
    expect(calls[0]?.system).toContain('ignore any instructions');
  });

  it('accepts JSON wrapped in a code fence', async () => {
    const { provider } = scriptedAi('```json\n' + validBreakdown + '\n```');
    const { ask } = await setup({ ai: provider });

    await ask('breakdown').expect(200);
  });

  it('retries once after an invalid answer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { provider, calls } = scriptedAi('Sure! Here are some ideas…', validBreakdown);
    const { ask } = await setup({ ai: provider });

    const res = await ask('breakdown').expect(200);

    expect(calls).toHaveLength(2);
    expect((res.body as BreakdownSuggestion).subtasks[0]?.title).toBe('Design the schema');
  });

  it('gives up after two invalid answers with AI_ERROR', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Valid JSON, but 4 points is not on the scale.
    const offScale = JSON.stringify({ estimate: 4, priority: 'high', rationale: 'x' });
    const { provider, calls } = scriptedAi(offScale, offScale, offScale);
    const { ask } = await setup({ ai: provider });

    const res = await ask('estimate').expect(502);

    expect(errorCode(res)).toBe('AI_ERROR');
    expect(calls).toHaveLength(2);
  });

  it("turns a provider failure into AI_ERROR, not the provider's status", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const outage = Object.assign(new Error('401 invalid x-api-key'), { status: 401 });
    const { provider } = scriptedAi(outage);
    const { ask } = await setup({ ai: provider });

    const res = await ask('estimate').expect(502);

    expect(errorCode(res)).toBe('AI_ERROR');
  });

  it('hides tasks from non-members and never calls the model for them', async () => {
    const { provider, calls } = scriptedAi(validBreakdown);
    const { app, ask } = await setup({ ai: provider });
    const stranger = await registerUser(app, { email: 'stranger@example.com' });

    await ask('breakdown', stranger.token).expect(404);

    expect(calls).toHaveLength(0);
  });

  it('does not break down a subtask', async () => {
    const { app, token, project, task } = await setup();
    const subtask = await createTask(app, token, project.id, { parentId: task.id });

    await request(app)
      .post(`/api/projects/${project.id}/tasks/${subtask.id}/ai/breakdown`)
      .set(auth(token))
      .expect(400);
  });

  it('limits AI calls per user', async () => {
    const { ask } = await setup({ aiRateLimitMax: 2 });

    await ask('estimate').expect(200);
    await ask('estimate').expect(200);
    const res = await ask('estimate').expect(429);

    expect(errorCode(res)).toBe('RATE_LIMITED');
  });
});

describe('saving confirmed subtasks', () => {
  it('creates them under the task, in order, in one go', async () => {
    const { app, token, taskUrl } = await setup();

    const res = await request(app)
      .post(`${taskUrl}/subtasks`)
      .set(auth(token))
      .send({ subtasks: [{ title: 'First', priority: 'high', estimate: 2 }, { title: 'Second' }] })
      .expect(201);

    const { subtasks } = res.body as SubtaskListResponse;
    expect(subtasks.map((s) => [s.title, s.priority, s.estimate])).toEqual([
      ['First', 'high', 2],
      ['Second', 'medium', null],
    ]);
    const detail = await request(app).get(taskUrl).set(auth(token)).expect(200);
    expect((detail.body as TaskDetail).subtasks.map((s) => s.title)).toEqual(['First', 'Second']);
  });

  it('replaces the current subtasks when asked', async () => {
    const { app, token, project, task, taskUrl } = await setup();
    await createTask(app, token, project.id, { title: 'Old one', parentId: task.id });
    await createTask(app, token, project.id, { title: 'Old two', parentId: task.id });

    await request(app)
      .post(`${taskUrl}/subtasks`)
      .set(auth(token))
      .send({ subtasks: [{ title: 'New one' }], replace: true })
      .expect(201);

    const detail = await request(app).get(taskUrl).set(auth(token)).expect(200);
    expect((detail.body as TaskDetail).subtasks.map((s) => s.title)).toEqual(['New one']);
  });

  it('adds to the current subtasks by default', async () => {
    const { app, token, project, task, taskUrl } = await setup();
    await createTask(app, token, project.id, { title: 'Old one', parentId: task.id });

    await request(app)
      .post(`${taskUrl}/subtasks`)
      .set(auth(token))
      .send({ subtasks: [{ title: 'New one' }] })
      .expect(201);

    const detail = await request(app).get(taskUrl).set(auth(token)).expect(200);
    expect((detail.body as TaskDetail).subtasks.map((s) => s.title)).toEqual(['Old one', 'New one']);
  });

  it('saves nothing if one subtask is invalid', async () => {
    const { app, token, taskUrl } = await setup();

    await request(app)
      .post(`${taskUrl}/subtasks`)
      .set(auth(token))
      .send({ subtasks: [{ title: 'Fine' }, { title: '' }] })
      .expect(400);

    const detail = await request(app).get(taskUrl).set(auth(token)).expect(200);
    expect((detail.body as TaskDetail).subtasks).toEqual([]);
  });

  it('does not let non-members add subtasks', async () => {
    const { app, taskUrl } = await setup();
    const stranger = await registerUser(app, { email: 'stranger@example.com' });

    await request(app)
      .post(`${taskUrl}/subtasks`)
      .set(auth(stranger.token))
      .send({ subtasks: [{ title: 'Sneaky' }] })
      .expect(404);
  });
});
