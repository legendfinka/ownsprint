import { Router } from 'express';
import {
  createTaskSchema,
  moveTaskSchema,
  projectParamsSchema,
  taskParamsSchema,
  taskQuerySchema,
  updateTaskSchema,
} from '@ownsprint/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as tasks from './tasks.controller';

// Mounted at /projects/:projectId/tasks. mergeParams keeps :projectId visible here.
export const tasksRouter = Router({ mergeParams: true });

tasksRouter.use(authenticate);

tasksRouter.get('/', validate({ params: projectParamsSchema, query: taskQuerySchema }), tasks.list);
tasksRouter.post(
  '/',
  validate({ params: projectParamsSchema, body: createTaskSchema }),
  tasks.create,
);
tasksRouter.get('/:taskId', validate({ params: taskParamsSchema }), tasks.get);
tasksRouter.patch(
  '/:taskId',
  validate({ params: taskParamsSchema, body: updateTaskSchema }),
  tasks.update,
);
tasksRouter.post(
  '/:taskId/move',
  validate({ params: taskParamsSchema, body: moveTaskSchema }),
  tasks.move,
);
tasksRouter.delete('/:taskId', validate({ params: taskParamsSchema }), tasks.remove);
