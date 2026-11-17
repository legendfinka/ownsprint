import { Router } from 'express';
import {
  completeSprintSchema,
  createSprintSchema,
  projectParamsSchema,
  sprintParamsSchema,
  updateSprintSchema,
} from '@ownsprint/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as tasks from '../tasks/tasks.controller';
import * as sprints from './sprints.controller';

// Mounted at /projects/:projectId/sprints. mergeParams keeps :projectId visible here.
export const sprintsRouter = Router({ mergeParams: true });

sprintsRouter.use(authenticate);

sprintsRouter.get('/', validate({ params: projectParamsSchema }), sprints.list);
sprintsRouter.post(
  '/',
  validate({ params: projectParamsSchema, body: createSprintSchema }),
  sprints.create,
);
sprintsRouter.patch(
  '/:sprintId',
  validate({ params: sprintParamsSchema, body: updateSprintSchema }),
  sprints.update,
);
sprintsRouter.post('/:sprintId/start', validate({ params: sprintParamsSchema }), sprints.start);
sprintsRouter.post(
  '/:sprintId/complete',
  validate({ params: sprintParamsSchema, body: completeSprintSchema }),
  sprints.complete,
);
// The sprint's board. Its tasks are served by the tasks module.
sprintsRouter.get('/:sprintId/board', validate({ params: sprintParamsSchema }), tasks.board);
sprintsRouter.delete('/:sprintId', validate({ params: sprintParamsSchema }), sprints.remove);
