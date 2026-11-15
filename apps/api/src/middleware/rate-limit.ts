import { rateLimit } from 'express-rate-limit';
import { RateLimitError } from '../lib/errors';

// Slows down password guessing. Counts are kept in memory (fine for one server).
export function createAuthRateLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitError()),
  });
}
