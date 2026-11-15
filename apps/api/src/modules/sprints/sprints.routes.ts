import { Router } from 'express';
import {
  createSprintSchema,
  projectParamsSchema,
  sprintParamsSchema,
  updateSprintSchema,
} from '@ownsprint/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
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
sprintsRouter.delete('/:sprintId', validate({ params: sprintParamsSchema }), sprints.remove);
