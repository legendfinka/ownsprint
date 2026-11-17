import { z } from 'zod';
import {
  breakdownSuggestionSchema,
  descriptionSuggestionSchema,
  estimateSuggestionSchema,
  MAX_BULK_ESTIMATES,
  type BreakdownSuggestion,
  type DescriptionSuggestion,
  type EstimateSuggestion,
  type SprintEstimates,
} from '@ownsprint/shared';
import { AiError, ValidationError } from '../../lib/errors';
import { getSprintById } from '../sprints/sprints.service';
import { getBoard, getTask } from '../tasks/tasks.service';
import { breakdownPrompt } from './prompts/breakdown.prompt';
import { descriptionPrompt } from './prompts/description.prompt';
import { estimatePrompt } from './prompts/estimate.prompt';
import { estimatesAnswerSchema, estimatesPrompt } from './prompts/estimates.prompt';
import { summaryPrompt } from './prompts/summary.prompt';
import type { AiProvider, AiRequest } from './providers/ai-provider';

// Suggestions only: nothing here writes to the database. The user reviews
// a suggestion and saves it with the normal task endpoints.
export function createAiService(provider: AiProvider) {
  // Ask, parse, validate. A bad answer gets one more try, then a clear error.
  async function ask<T>(request: AiRequest, schema: z.ZodType<T>): Promise<T> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const text = await complete(request);
      const result = schema.safeParse(parseJson(text));
      if (result.success) return result.data;
      // The start of what the model said, so a bad prompt can be told from a bad model.
      console.warn(
        `AI ${request.task}: invalid answer (try ${String(attempt)})\n${z.prettifyError(result.error)}\n` +
          `Model said: ${text.slice(0, 600)}`,
      );
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

  // The same rule for streams: provider errors become AiError, and a user who
  // left (aborted) is not an error. An empty answer is one, though.
  async function* streamText(request: AiRequest): AsyncGenerator<string> {
    let received = false;
    try {
      for await (const text of provider.stream(request)) {
        received = true;
        yield text;
      }
    } catch (error) {
      if (request.signal?.aborted) return;
      console.error(`AI ${request.task}: provider failed`, error);
      throw new AiError('The AI service is unavailable right now. Please try again later.');
    }
    if (!received && !request.signal?.aborted) throw new AiError('The AI gave an empty answer.');
  }

  return {
    // Suggests points for the sprint's tasks that have none, in one request,
    // so the model can size them against each other. Saves nothing.
    async estimateMissing(
      userId: string,
      projectId: string,
      sprintId: string,
    ): Promise<SprintEstimates> {
      const sprint = await getSprintById(userId, projectId, sprintId); // checks access too
      const { tasks } = await getBoard(userId, projectId, sprintId);
      const missing = tasks.filter((t) => t.estimate === null);
      if (missing.length === 0) {
        throw ValidationError.fields({ sprintId: 'Every task in this sprint has an estimate' });
      }

      const batch = missing.slice(0, MAX_BULK_ESTIMATES);
      const known = tasks.filter((t) => t.estimate !== null);
      const answer = await ask(estimatesPrompt(sprint, batch, known), estimatesAnswerSchema);

      // Back from numbers to ids. A number the model made up, or repeated, is dropped.
      const seen = new Set<number>();
      const suggestions = answer.estimates.flatMap(({ n, estimate, rationale }) => {
        const task = batch[n - 1];
        if (!task || seen.has(n)) return [];
        seen.add(n);
        return [{ taskId: task.id, estimate, rationale }];
      });
      if (suggestions.length === 0) {
        console.warn(
          `AI estimates: no answer matched a task (sent ${String(batch.length)})\n${JSON.stringify(answer)}`,
        );
        throw new AiError('The AI gave an unusable answer. Please try again.');
      }
      return { suggestions, remaining: missing.length - batch.length };
    },

    // Checks everything first, so a bad request fails before any streaming starts.
    async summarize(
      userId: string,
      projectId: string,
      sprintId: string,
      signal: AbortSignal,
    ): Promise<AsyncIterable<string>> {
      const sprint = await getSprintById(userId, projectId, sprintId); // checks access too
      const { tasks } = await getBoard(userId, projectId, sprintId);
      if (tasks.length === 0) {
        throw ValidationError.fields({ sprintId: 'This sprint has no tasks to summarize' });
      }
      const today = new Date().toISOString().slice(0, 10);
      return streamText({ ...summaryPrompt(sprint, tasks, today), signal });
    },

    async breakdown(
      userId: string,
      projectId: string,
      taskId: string,
    ): Promise<BreakdownSuggestion> {
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
