import type { Request, Response } from 'express';
import type {
  BreakdownSuggestion,
  DescriptionSuggestion,
  EstimateSuggestion,
} from '@ownsprint/shared';
import { requireUserId } from '../../middleware/authenticate';
import type { AiService } from './ai.service';

// Params are already checked by `validate` in ai.routes.ts.
type Params = { projectId: string; taskId: string };

// Built around a service, because the service depends on the chosen provider.
// Arrow functions, since Express calls them detached from this object.
export function createAiController(ai: AiService) {
  return {
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
