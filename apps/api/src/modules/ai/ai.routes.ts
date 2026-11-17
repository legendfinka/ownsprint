import { Router } from 'express';
import { taskParamsSchema } from '@ownsprint/shared';
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

// Mounted at /projects/:projectId/tasks/:taskId/ai. Takes the provider as an
// argument, so tests can pass a fake one.
export function createAiRouter(provider: AiProvider, rateLimitMax: number): Router {
  const ai = createAiController(createAiService(provider));
  const router = Router({ mergeParams: true });

  router.use(authenticate, createAiRateLimiter(rateLimitMax));
  router.post('/breakdown', validate({ params: taskParamsSchema }), ai.breakdown);
  router.post('/estimate', validate({ params: taskParamsSchema }), ai.estimate);
  router.post('/description', validate({ params: taskParamsSchema }), ai.describe);

  return router;
}
