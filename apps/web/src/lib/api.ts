import type { ErrorCode, ErrorResponse, RefreshResponse } from '@ownsprint/shared';

// The one place the web app talks to the API.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

// Kept in memory only (not localStorage), so injected scripts can't read it.
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let onSessionExpired = () => {};

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Called when the session can't be renewed, so the app can show the login page.
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// Gets a new access token using the refresh cookie. Requests that fail at the
// same time share one refresh, because each refresh token works only once.
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST' })
    .then(async (res) => (res.ok ? ((await res.json()) as RefreshResponse).accessToken : null))
    .catch(() => null)
    .then((token) => {
      accessToken = token;
      return token;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

// api<ProjectListResponse>('/projects') → GET /api/projects
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options);

  // Expired access token: renew it and try once more. Auth endpoints answer
  // 401 for wrong passwords, so those are never retried.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) {
      res = await send(path, options);
    } else {
      onSessionExpired();
    }
  }

  if (!res.ok) throw await toApiError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

function send(path: string, { method = 'GET', body }: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  return fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ErrorResponse | null;
  return new ApiError(
    res.status,
    body?.error.code ?? 'INTERNAL_ERROR',
    body?.error.message ?? 'Something went wrong',
    body?.error.details,
  );
}
