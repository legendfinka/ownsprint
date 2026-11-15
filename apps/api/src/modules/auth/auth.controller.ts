import type { CookieOptions, Request, Response } from 'express';
import type {
  AuthResponse,
  LoginInput,
  MeResponse,
  RefreshResponse,
  RegisterInput,
} from '@ownsprint/shared';
import { env } from '../../config/env';
import { requireUserId } from '../../middleware/authenticate';
import * as authService from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript can't read it, so XSS can't steal it
  secure: env.NODE_ENV === 'production', // HTTPS only
  sameSite: 'strict', // not sent from other sites (CSRF)
  path: '/auth', // only sent to auth endpoints
};

// req.body is already checked by `validate` in auth.routes.ts.

export async function register(req: Request, res: Response<AuthResponse>): Promise<void> {
  const { refreshToken, ...session } = await authService.register(req.body as RegisterInput);
  setRefreshCookie(res, refreshToken);
  res.status(201).json(session);
}

export async function login(req: Request, res: Response<AuthResponse>): Promise<void> {
  const { refreshToken, ...session } = await authService.login(req.body as LoginInput);
  setRefreshCookie(res, refreshToken);
  res.json(session);
}

export async function refresh(req: Request, res: Response<RefreshResponse>): Promise<void> {
  const { refreshToken, accessToken } = await authService.refresh(readRefreshCookie(req));
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req));
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).end();
}

export async function me(req: Request, res: Response<MeResponse>): Promise<void> {
  res.json({ user: await authService.getCurrentUser(requireUserId(req)) });
}

function setRefreshCookie(res: Response, token: string): void {
  const maxAge = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, maxAge });
}

function readRefreshCookie(req: Request): string | undefined {
  const token: unknown = req.cookies[REFRESH_COOKIE];
  return typeof token === 'string' && token ? token : undefined;
}
