import { Router } from 'express';
import { loginSchema, registerSchema } from '@ownsprint/shared';
import { authenticate } from '../../middleware/authenticate';
import { createAuthRateLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import * as auth from './auth.controller';

export function createAuthRouter(rateLimitMax: number): Router {
  const router = Router();
  const limiter = createAuthRateLimiter(rateLimitMax); // shared by register and login

  router.post('/register', limiter, validate({ body: registerSchema }), auth.register);
  router.post('/login', limiter, validate({ body: loginSchema }), auth.login);
  router.post('/refresh', auth.refresh);
  router.post('/logout', auth.logout);
  router.get('/me', authenticate, auth.me);

  return router;
}
