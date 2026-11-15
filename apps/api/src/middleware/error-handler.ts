import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { ErrorResponse } from '@ownsprint/shared';
import { AppError, NotFoundError } from '../lib/errors';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

// Express 5 sends errors from async handlers here, so no try/catch is needed in routes.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    sendError(res, err.status, { code: err.code, message: err.message, details: err.details });
    return;
  }

  // Body parser errors (bad JSON, body too large) come with a 4xx status.
  const status = clientErrorStatus(err);
  if (status) {
    sendError(res, status, { code: 'BAD_REQUEST', message: 'Malformed request' });
    return;
  }

  // A real bug: log it, but don't leak details to the client.
  console.error(err);
  sendError(res, 500, { code: 'INTERNAL_ERROR', message: 'Internal server error' });
};

function sendError(res: Response, status: number, error: ErrorResponse['error']): void {
  res.status(status).json({ error });
}

function clientErrorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}
