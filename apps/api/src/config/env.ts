import { z } from 'zod';

// `KEY=` in .env arrives as "", not missing: treat both the same.
const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10), // per IP per 15 min

  // Who answers the AI buttons: the free built-in mock (default), a local
  // Ollama model, or Anthropic's API. See .env.example for setup.
  AI_PROVIDER: z.enum(['mock', 'ollama', 'anthropic']).default('mock'),
  AI_MODEL: optional, // empty: the provider's default model
  ANTHROPIC_API_KEY: optional,
  OLLAMA_URL: z.url().default('http://localhost:11434'),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20), // per user per hour
});

export type Env = z.infer<typeof envSchema>;

// Crash on startup with a clear message instead of failing later.
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
