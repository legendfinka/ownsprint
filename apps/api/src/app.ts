import cookieParser from 'cookie-parser';
import express, { Router, type Express } from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { createAuthRouter } from './modules/auth/auth.routes';
import { projectsRouter } from './modules/projects/projects.routes';
import { sprintsRouter } from './modules/sprints/sprints.routes';
import { tasksRouter } from './modules/tasks/tasks.routes';

// Kept separate from server.ts so tests can use the app without opening a port.
export function createApp({ authRateLimitMax = env.AUTH_RATE_LIMIT_MAX } = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Everything lives under /api, so the web app can proxy one prefix
  // and keep its own URLs (like /projects) for pages.
  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use('/auth', createAuthRouter(authRateLimitMax));
  api.use('/projects/:projectId/sprints', sprintsRouter);
  api.use('/projects/:projectId/tasks', tasksRouter);
  api.use('/projects', projectsRouter);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
