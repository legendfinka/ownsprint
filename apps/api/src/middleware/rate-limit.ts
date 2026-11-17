import { rateLimit } from 'express-rate-limit';
import { RateLimitError } from '../lib/errors';
import { requireUserId } from './authenticate';

// Counts are kept in memory (fine for one server).

// Slows down password guessing.
export function createAuthRateLimiter(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new RateLimitError()),
  });
}

// AI calls cost money, so each user gets a budget per hour.
// Counted per user, not per IP. Must run after `authenticate`.
export function createAiRateLimiter(limit: number) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    keyGenerator: (req) => requireUserId(req),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new RateLimitError('AI limit reached for this hour. Try again later.')),
  });
}
