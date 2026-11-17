import { z } from 'zod';
import {
  breakdownSuggestionSchema,
  descriptionSuggestionSchema,
  estimateSuggestionSchema,
  type BreakdownSuggestion,
  type DescriptionSuggestion,
  type EstimateSuggestion,
} from '@ownsprint/shared';
import { AiError, ValidationError } from '../../lib/errors';
import { getTask } from '../tasks/tasks.service';
import { breakdownPrompt } from './prompts/breakdown.prompt';
import { descriptionPrompt } from './prompts/description.prompt';
import { estimatePrompt } from './prompts/estimate.prompt';
import type { AiProvider, AiRequest } from './providers/ai-provider';

// Suggestions only: nothing here writes to the database. The user reviews
// a suggestion and saves it with the normal task endpoints.
export function createAiService(provider: AiProvider) {
  // Ask, parse, validate. A bad answer gets one more try, then a clear error.
  async function ask<T>(request: AiRequest, schema: z.ZodType<T>): Promise<T> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = schema.safeParse(parseJson(await complete(request)));
      if (result.success) return result.data;
      console.warn(`AI ${request.task}: invalid answer (try ${attempt})\n${z.prettifyError(result.error)}`);
    }
    throw new AiError('The AI gave an unusable answer. Please try again.');
  }

  // Provider errors (bad key, outage, timeout) carry their own HTTP status.
  // Never pass them on as-is: a 401 from Anthropic is not the user's 401.
  async function complete(request: AiRequest): Promise<string> {
    try {
      return await provider.complete(request);
    } catch (error) {
      console.error(`AI ${request.task}: provider failed`, error);
      throw new AiError('The AI service is unavailable right now. Please try again later.');
    }
  }

  return {
    async breakdown(userId: string, projectId: string, taskId: string): Promise<BreakdownSuggestion> {
      const task = await getTask(userId, projectId, taskId); // checks access too
      if (task.parentId) {
        throw ValidationError.fields({ taskId: 'Subtasks cannot be broken down further' });
      }
      return ask(breakdownPrompt(task), breakdownSuggestionSchema);
    },

    async estimate(userId: string, projectId: string, taskId: string): Promise<EstimateSuggestion> {
      const task = await getTask(userId, projectId, taskId);
      return ask(estimatePrompt(task), estimateSuggestionSchema);
    },

    async describe(
      userId: string,
      projectId: string,
      taskId: string,
    ): Promise<DescriptionSuggestion> {
      const task = await getTask(userId, projectId, taskId);
      return ask(descriptionPrompt(task), descriptionSuggestionSchema);
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;

// Models sometimes wrap JSON in ```json fences or add a sentence around it,
// so take the outermost {...}. Anything unparseable becomes undefined and
// fails validation like any other bad answer.
function parseJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
