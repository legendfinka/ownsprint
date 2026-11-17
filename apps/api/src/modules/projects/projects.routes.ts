import { Router } from 'express';
import {
  addMemberSchema,
  memberParamsSchema,
  projectNameSchema,
  projectParamsSchema as params,
  updateMemberSchema,
} from '@ownsprint/shared';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as projects from './projects.controller';

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.post('/', validate({ body: projectNameSchema }), projects.create);
projectsRouter.get('/', projects.list);
projectsRouter.get('/:projectId', validate({ params }), projects.get);
projectsRouter.patch('/:projectId', validate({ params, body: projectNameSchema }), projects.rename);
projectsRouter.delete('/:projectId', validate({ params }), projects.remove);

projectsRouter.post(
  '/:projectId/members',
  validate({ params, body: addMemberSchema }),
  projects.addMember,
);
projectsRouter.patch(
  '/:projectId/members/:userId',
  validate({ params: memberParamsSchema, body: updateMemberSchema }),
  projects.updateMember,
);
projectsRouter.delete(
  '/:projectId/members/:userId',
  validate({ params: memberParamsSchema }),
  projects.removeMember,
);
