import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type {
  ErrorResponse,
  ProjectDetail,
  ProjectListResponse,
  ProjectMember,
  ProjectSummary,
} from '@ownsprint/shared';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { auth, createProject, registerUser } from '../../../test/helpers';

const app = createApp();
const errorCode = (res: request.Response) => (res.body as ErrorResponse).error.code;

// An owner, a member and an outsider around one project.
async function setup() {
  const owner = await registerUser(app, { email: 'owner@example.com', name: 'Olivia' });
  const member = await registerUser(app, { email: 'member@example.com', name: 'Mark' });
  const outsider = await registerUser(app, { email: 'outsider@example.com', name: 'Otto' });
  const project = await createProject(app, owner.token);
  await request(app)
    .post(`/api/projects/${project.id}/members`)
    .set(auth(owner.token))
    .send({ email: 'member@example.com' })
    .expect(201);

  return { owner, member, outsider, project, url: `/api/projects/${project.id}` };
}

describe('projects', () => {
  it('makes the creator the owner', async () => {
    const { token } = await registerUser(app);

    const res = await request(app)
      .post('/api/projects')
      .set(auth(token))
      .send({ name: '  Website  ' })
      .expect(201);

    expect(res.body as ProjectSummary).toMatchObject({ name: 'Website', role: 'owner' });
  });

  it('lists only projects the user belongs to', async () => {
    const { member, outsider, project } = await setup();

    const memberList = await request(app).get('/api/projects').set(auth(member.token)).expect(200);
    const outsiderList = await request(app)
      .get('/api/projects')
      .set(auth(outsider.token))
      .expect(200);

    expect((memberList.body as ProjectListResponse).projects).toEqual([
      expect.objectContaining({ id: project.id, role: 'member' }),
    ]);
    expect((outsiderList.body as ProjectListResponse).projects).toEqual([]);
  });

  it('requires login', async () => {
    await request(app).get('/api/projects').expect(401);
  });

  it('returns 400 for an invalid project id', async () => {
    const { token } = await registerUser(app);
    const res = await request(app).get('/api/projects/not-a-uuid').set(auth(token)).expect(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });
});

describe('project access', () => {
  it('hides the project from outsiders with 404 on every endpoint', async () => {
    const { outsider, member, url } = await setup();
    const as = auth(outsider.token);

    const responses = await Promise.all([
      request(app).get(url).set(as),
      request(app).patch(url).set(as).send({ name: 'Hacked' }),
      request(app).delete(url).set(as),
      request(app).post(`${url}/members`).set(as).send({ email: 'outsider@example.com' }),
      request(app).delete(`${url}/members/${member.body.user.id}`).set(as),
    ]);

    for (const res of responses) expect(res.status).toBe(404);
  });

  it('lets members view the project but not manage it', async () => {
    const { owner, member, url } = await setup();
    const as = auth(member.token);

    const res = await request(app).get(url).set(as).expect(200);
    expect((res.body as ProjectDetail).members).toEqual([
      { id: member.body.user.id, name: 'Mark', email: 'member@example.com', role: 'member' },
      { id: owner.body.user.id, name: 'Olivia', email: 'owner@example.com', role: 'owner' },
    ]);

    const responses = await Promise.all([
      request(app).patch(url).set(as).send({ name: 'Renamed' }),
      request(app).delete(url).set(as),
      request(app).post(`${url}/members`).set(as).send({ email: 'outsider@example.com' }),
      request(app).delete(`${url}/members/${owner.body.user.id}`).set(as),
    ]);

    for (const res of responses) expect(res.status).toBe(403);
  });

  it('lets the owner rename and delete the project', async () => {
    const { owner, url, project } = await setup();
    const as = auth(owner.token);

    const res = await request(app).patch(url).set(as).send({ name: 'New name' }).expect(200);
    expect((res.body as ProjectSummary).name).toBe('New name');

    await request(app).delete(url).set(as).expect(204);
    await request(app).get(url).set(as).expect(404);
    expect(await prisma.membership.count({ where: { projectId: project.id } })).toBe(0);
  });
});

describe('project members', () => {
  it('adds a member by email, ignoring letter case', async () => {
    const { owner, outsider, url } = await setup();

    const res = await request(app)
      .post(`${url}/members`)
      .set(auth(owner.token))
      .send({ email: 'OUTSIDER@example.com' })
      .expect(201);

    expect(res.body as ProjectMember).toMatchObject({ id: outsider.body.user.id, role: 'member' });
    await request(app).get(url).set(auth(outsider.token)).expect(200);
  });

  it('rejects unknown emails and existing members', async () => {
    const { owner, url } = await setup();
    const add = (email: string) =>
      request(app).post(`${url}/members`).set(auth(owner.token)).send({ email });

    expect(errorCode(await add('nobody@example.com').expect(404))).toBe('NOT_FOUND');
    expect(errorCode(await add('member@example.com').expect(409))).toBe('CONFLICT');
  });

  it('removes a member, who then loses access', async () => {
    const { owner, member, url } = await setup();

    await request(app)
      .delete(`${url}/members/${member.body.user.id}`)
      .set(auth(owner.token))
      .expect(204);

    await request(app).get(url).set(auth(member.token)).expect(404);
  });

  it('never removes the owner', async () => {
    const { owner, url } = await setup();

    const res = await request(app)
      .delete(`${url}/members/${owner.body.user.id}`)
      .set(auth(owner.token))
      .expect(409);

    expect(errorCode(res)).toBe('CONFLICT');
  });
});
