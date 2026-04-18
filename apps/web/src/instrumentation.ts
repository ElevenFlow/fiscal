/**
 * Next.js instrumentation hook (server-side, Node runtime).
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Carrega Sentry server apenas quando DSN configurado.
 * No-op em dev (sem DSN) e em runtime Edge (NEXT_RUNTIME !== 'nodejs').
 *
 * Plan 01-10: defense-in-depth — beforeSend scrub request.data/cookies mesmo que
 * outras camadas (Pino redact / safeLog) estejam aplicadas upstream.
 */
export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      beforeSend(event) {
        if (event.request) {
          event.request.data = '[REDACTED]';
          event.request.cookies = { scrubbed: '[REDACTED]' };
        }
        return event;
      },
    });
  }
}
