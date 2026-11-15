import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import { ValidationError } from '../lib/errors';

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

// Checks the request with Zod and swaps in the cleaned-up values.
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const errors: Record<string, unknown> = {};

    for (const part of ['body', 'params', 'query'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        // req.query is read-only in Express 5, so redefine it instead of assigning.
        Object.defineProperty(req, part, {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        errors[part] = z.flattenError(result.error);
      }
    }

    next(Object.keys(errors).length > 0 ? new ValidationError(errors) : undefined);
  };
}
