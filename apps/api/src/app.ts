import express, { type Express } from 'express';

// The app is built separately from server.ts so tests can mount it with Supertest
// without opening a port.
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
