import { Router } from 'express';
import { sprintParamsSchema, taskParamsSchema } from '@ownsprint/shared';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/authenticate';
import { createAiRateLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import { createAiController } from './ai.controller';
import { createAiService } from './ai.service';
import type { AiProvider } from './providers/ai-provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { MockAiProvider } from './providers/mock.provider';
import { OllamaProvider } from './providers/ollama.provider';

// The provider picked by AI_PROVIDER in .env, with a sensible default model.
// Runs at startup, so a missing key stops the server with a clear message.
export function defaultAiProvider(): AiProvider {
  switch (env.AI_PROVIDER) {
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('AI_PROVIDER=anthropic needs ANTHROPIC_API_KEY in .env (or use mock)');
      }
      return new AnthropicProvider(env.ANTHROPIC_API_KEY, env.AI_MODEL ?? 'claude-haiku-5-5');
    case 'ollama':
      return new OllamaProvider(env.OLLAMA_URL, env.AI_MODEL ?? 'qwen2.5:7b');
    case 'mock':
      return new MockAiProvider();
  }
}

// Mounted at /projects/:projectId. Takes the provider as an argument, so
// tests can pass a fake one.
export function createAiRouter(provider: AiProvider, rateLimitMax: number): Router {
  const ai = createAiController(createAiService(provider));
  const router = Router({ mergeParams: true });

  // On each route, not router.use: this router sits in front of the other
  // project routes, which must not be rate limited as AI calls. One limiter
  // instance, so all AI calls share one budget per user.
  const guard = [authenticate, createAiRateLimiter(rateLimitMax)];
  const task = validate({ params: taskParamsSchema });
  router.post('/tasks/:taskId/ai/breakdown', guard, task, ai.breakdown);
  router.post('/tasks/:taskId/ai/estimate', guard, task, ai.estimate);
  router.post('/tasks/:taskId/ai/description', guard, task, ai.describe);
  const sprint = validate({ params: sprintParamsSchema });
  router.post('/sprints/:sprintId/ai/summary', guard, sprint, ai.summary);
  router.post('/sprints/:sprintId/ai/estimates', guard, sprint, ai.estimates);

  return router;
}
