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
  // Database — app_admin (BYPASSRLS) apenas para migrations/seed.
  // Opcional no runtime serverless: a API deve subir apenas com DATABASE_URL.
  DATABASE_ADMIN_URL: z.string().url().optional(),

  // Clerk (placeholders — serão removidos em Plan 02.1-04; mantidos optional durante transição)
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // Auth in-house (Plan 02.1-02) — substitui Clerk
  // Em prod: mínimo 32 chars obrigatório. Em dev: fallback no JwtService se ausente.
  AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET deve ter pelo menos 32 caracteres').optional(),
  ALLOW_HEADER_AUTH: z.string().optional(),

  // AWS (placeholders Plan 08)
  AWS_REGION: z.string().default('sa-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_FISCAL: z.string().optional(),
  S3_BUCKET_CERTS: z.string().optional(),

  // BullMQ / Redis (Plan 02-05 — cron de alertas certificado A1)
  // Em dev: redis://localhost:6380 (docker-compose). Em prod: ElastiCache (rediss://).
  // Opcional — se ausente, scheduler/processor vira no-op com log warning (modo dev sem Redis).
  REDIS_URL: z.string().url().optional(),

  // Observability
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3333'),
});

export type Env = z.infer<typeof EnvSchema>;
