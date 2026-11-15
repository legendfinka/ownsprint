import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { createAuthRouter } from './modules/auth/auth.routes';

// Kept separate from server.ts so tests can use the app without opening a port.
export function createApp({ authRateLimitMax = env.AUTH_RATE_LIMIT_MAX } = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/auth', createAuthRouter(authRateLimitMax));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
