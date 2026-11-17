import type { Request, Response } from 'express';
import type {
  BreakdownSuggestion,
  DescriptionSuggestion,
  EstimateSuggestion,
  SprintEstimates,
  SummaryChunk,
  SummaryError,
} from '@ownsprint/shared';
import { AppError } from '../../lib/errors';
import { requireUserId } from '../../middleware/authenticate';
import type { AiService } from './ai.service';

// Params are already checked by `validate` in ai.routes.ts.
type Params = { projectId: string; taskId: string };

// Built around a service, because the service depends on the chosen provider.
// Arrow functions, since Express calls them detached from this object.
export function createAiController(ai: AiService) {
  return {
    // Streams the text as server-sent events. Errors found before the first
    // piece arrives are normal JSON errors; later ones can only be sent as an event.
    summary: async (req: Request, res: Response): Promise<void> => {
      const { projectId, sprintId } = req.params as { projectId: string; sprintId: string };
      const stop = new AbortController();
      res.on('close', () => stop.abort()); // the user left: stop asking the model

      const pieces = (await ai.summarize(requireUserId(req), projectId, sprintId, stop.signal))[
        Symbol.asyncIterator
      ]();
      let next = await pieces.next();

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no', // tell proxies (nginx) not to hold the stream back
      });
      const send = (event: string, data: SummaryChunk | SummaryError | Record<string, never>) =>
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      try {
        for (; !next.done && !stop.signal.aborted; next = await pieces.next()) {
          send('message', { text: next.value });
        }
        send('done', {});
      } catch (error) {
        // Only our own errors have messages meant for users.
        send('error', {
          message: error instanceof AppError ? error.message : 'Something went wrong',
        });
      }
      res.end();
    },

    estimates: async (req: Request, res: Response<SprintEstimates>): Promise<void> => {
      const { projectId, sprintId } = req.params as { projectId: string; sprintId: string };
      res.json(await ai.estimateMissing(requireUserId(req), projectId, sprintId));
    },

    breakdown: async (req: Request, res: Response<BreakdownSuggestion>): Promise<void> => {
      const { projectId, taskId } = req.params as Params;
      res.json(await ai.breakdown(requireUserId(req), projectId, taskId));
    },

    estimate: async (req: Request, res: Response<EstimateSuggestion>): Promise<void> => {
      const { projectId, taskId } = req.params as Params;
      res.json(await ai.estimate(requireUserId(req), projectId, taskId));
    },

    describe: async (req: Request, res: Response<DescriptionSuggestion>): Promise<void> => {
      const { projectId, taskId } = req.params as Params;
      res.json(await ai.describe(requireUserId(req), projectId, taskId));
    },
  };
}
