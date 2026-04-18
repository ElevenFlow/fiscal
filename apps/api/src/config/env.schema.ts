import { z } from 'zod';

/**
 * Schema de variáveis de ambiente obrigatórias para apps/api.
 * Validação roda no bootstrap; falha rápida se alguma env crítica está ausente.
 */
export const EnvSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('debug'),

  // Database — app_user (NOBYPASSRLS) para runtime
  DATABASE_URL: z.string().url(),
  // Database — app_admin (BYPASSRLS) apenas para migrations/seed
  DATABASE_ADMIN_URL: z.string().url(),

  // Clerk (placeholders preenchidos pelo Plan 07)
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // AWS (placeholders Plan 08)
  AWS_REGION: z.string().default('sa-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_FISCAL: z.string().optional(),
  S3_BUCKET_CERTS: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3333'),
});

export type Env = z.infer<typeof EnvSchema>;
