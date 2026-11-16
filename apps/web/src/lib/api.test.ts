import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setAccessToken, setSessionExpiredHandler } from './api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const unauthorized = () =>
  json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, 401);

// A fake API: refresh returns "new-token", other endpoints only accept that token.
function fakeApi({ refreshWorks = true } = {}) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/auth/refresh') {
      // A small delay, like a real network, so parallel requests overlap.
      const res = refreshWorks ? json({ accessToken: 'new-token' }) : unauthorized();
      return new Promise<Response>((resolve) => setTimeout(() => resolve(res), 10));
    }
    const token = new Headers(init?.headers).get('Authorization');
    return Promise.resolve(token === 'Bearer new-token' ? json({ ok: true }) : unauthorized());
  });
  vi.stubGlobal('fetch', fetchMock);

  const refreshCount = () =>
    fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh').length;
  return { fetchMock, refreshCount };
}

beforeEach(() => {
  setAccessToken(null);
  setSessionExpiredHandler(() => {});
});

describe('api', () => {
  it('sends the access token', async () => {
    const { refreshCount } = fakeApi();
    setAccessToken('new-token');

    await expect(api('/projects')).resolves.toEqual({ ok: true });
    expect(refreshCount()).toBe(0);
  });

  it('refreshes an expired token and retries the request', async () => {
    const { refreshCount } = fakeApi();
    setAccessToken('expired-token');

    await expect(api('/projects')).resolves.toEqual({ ok: true });
    expect(refreshCount()).toBe(1);
  });

  it('uses one refresh for requests that fail at the same time', async () => {
    const { refreshCount } = fakeApi();

    await Promise.all([api('/projects'), api('/projects/1'), api('/projects/2')]);
    expect(refreshCount()).toBe(1);
  });

  it('reports an expired session when the refresh fails', async () => {
    fakeApi({ refreshWorks: false });
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    await expect(api('/projects')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it('never retries auth endpoints (401 there means a wrong password)', async () => {
    const { refreshCount } = fakeApi();

    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(refreshCount()).toBe(0);
  });
});
