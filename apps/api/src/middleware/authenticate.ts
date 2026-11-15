import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';

// Reads "Authorization: Bearer <token>" and sets req.userId.
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = /^Bearer (\S+)$/i.exec(req.get('authorization') ?? '')?.[1];
  if (!token) throw new UnauthorizedError();

  req.userId = await verifyAccessToken(token);
  next();
};

// Use in handlers behind `authenticate`. Fails loudly if the middleware was forgotten.
export function requireUserId(req: Request): string {
  if (!req.userId) throw new UnauthorizedError();
  return req.userId;
}
