import type { Request, Response } from 'express';
import type {
  CreateSprintInput,
  Sprint,
  SprintListResponse,
  UpdateSprintInput,
} from '@ownsprint/shared';
import { requireUserId } from '../../middleware/authenticate';
import * as sprints from './sprints.service';

// Params and body are already checked by `validate` in sprints.routes.ts.
type Params = { projectId: string; sprintId: string };

export async function list(req: Request, res: Response<SprintListResponse>): Promise<void> {
  const { projectId } = req.params as Params;
  res.json({ sprints: await sprints.listSprints(requireUserId(req), projectId) });
}

export async function create(req: Request, res: Response<Sprint>): Promise<void> {
  const { projectId } = req.params as Params;
  const input = req.body as CreateSprintInput;
  res.status(201).json(await sprints.createSprint(requireUserId(req), projectId, input));
}

export async function update(req: Request, res: Response<Sprint>): Promise<void> {
  const { projectId, sprintId } = req.params as Params;
  const input = req.body as UpdateSprintInput;
  res.json(await sprints.updateSprint(requireUserId(req), projectId, sprintId, input));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { projectId, sprintId } = req.params as Params;
  await sprints.deleteSprint(requireUserId(req), projectId, sprintId);
  res.status(204).end();
}
