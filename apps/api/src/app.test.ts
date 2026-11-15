import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ErrorResponse } from '@ownsprint/shared';
import { createApp } from './app';

const app = createApp();
const errorCode = (res: request.Response) => (res.body as ErrorResponse).error.code;

describe('app', () => {
  it('answers the health check', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 in the standard error shape', async () => {
    expect(errorCode(await request(app).get('/nope').expect(404))).toBe('NOT_FOUND');
  });

  it('returns 400 for broken JSON', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(errorCode(res)).toBe('BAD_REQUEST');
  });
});
