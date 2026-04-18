import { EnvSchema, type Env } from './env.schema';

/**
 * Lê e valida `process.env` no bootstrap. Lança erro descritivo se envs
 * críticas (DATABASE_URL, DATABASE_ADMIN_URL) estiverem ausentes ou inválidas.
 */
export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return parsed.data;
}
