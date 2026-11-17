import { Router } from 'express';
import {
  changeEmailSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '@ownsprint/shared';
import { authenticate } from '../../middleware/authenticate';
import { createAuthRateLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import * as auth from './auth.controller';

export function createAuthRouter(rateLimitMax: number): Router {
  const router = Router();
  const limiter = createAuthRateLimiter(rateLimitMax); // shared by register and login

  router.post('/register', limiter, validate({ body: registerSchema }), auth.register);
  router.post('/login', limiter, validate({ body: loginSchema }), auth.login);
  // Each call creates a user and a project, so it's limited like sign-up.
  router.post('/demo', limiter, auth.demo);
  router.post('/refresh', auth.refresh);
  router.post('/logout', auth.logout);
  router.get('/me', authenticate, auth.me);
  router.patch('/me', authenticate, validate({ body: updateProfileSchema }), auth.updateProfile);
  // These check the password, so they get the same brute-force limiter as login.
  router.patch(
    '/me/email',
    authenticate,
    limiter,
    validate({ body: changeEmailSchema }),
    auth.changeEmail,
  );
  router.patch(
    '/me/password',
    authenticate,
    limiter,
    validate({ body: changePasswordSchema }),
    auth.changePassword,
  );

  return router;
}
