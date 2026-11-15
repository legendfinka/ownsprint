import type { Request, Response } from 'express';
import type {
  CreateTaskInput,
  Page,
  Task,
  TaskDetail,
  TaskQuery,
  UpdateTaskInput,
} from '@ownsprint/shared';
import { requireUserId } from '../../middleware/authenticate';
import * as tasks from './tasks.service';

// Params, query and body are already checked by `validate` in tasks.routes.ts.
type Params = { projectId: string; taskId: string };

export async function list(req: Request, res: Response<Page<Task>>): Promise<void> {
  const { projectId } = req.params as Params;
  const query = req.query as unknown as TaskQuery;
  res.json(await tasks.listTasks(requireUserId(req), projectId, query));
}

export async function get(req: Request, res: Response<TaskDetail>): Promise<void> {
  const { projectId, taskId } = req.params as Params;
  res.json(await tasks.getTask(requireUserId(req), projectId, taskId));
}

export async function create(req: Request, res: Response<Task>): Promise<void> {
  const { projectId } = req.params as Params;
  const input = req.body as CreateTaskInput;
  res.status(201).json(await tasks.createTask(requireUserId(req), projectId, input));
}

export async function update(req: Request, res: Response<Task>): Promise<void> {
  const { projectId, taskId } = req.params as Params;
  const input = req.body as UpdateTaskInput;
  res.json(await tasks.updateTask(requireUserId(req), projectId, taskId, input));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { projectId, taskId } = req.params as Params;
  await tasks.deleteTask(requireUserId(req), projectId, taskId);
  res.status(204).end();
}
