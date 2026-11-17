import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { defaultAiProvider } from './modules/ai/ai.routes';

const ai = defaultAiProvider();
const app = createApp({ ai });

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${String(env.PORT)}`);
  console.log(`AI provider: ${ai.name}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
