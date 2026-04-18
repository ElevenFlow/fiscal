/**
 * Sentry browser init.
 * Importar e chamar `initSentryClient()` em um useEffect no ClientProviders/RootLayout.
 * No-op se NEXT_PUBLIC_SENTRY_DSN ausente ou fora do browser (SSR).
 *
 * Plan 01-10 — camada de scrubbing no frontend:
 *   - Browser SDK do Sentry NÃO envia request bodies por default (só user-agent/url).
 *   - replaysSessionSampleRate = 0 (replay de sessão desligado; opt-in em phase futura com mask de PII).
 *   - Para ativar replay com scrubbing forte, configurar `integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]`.
 *
 * Ver docs/OBSERVABILITY.md (camada 4 — Sentry UI data scrubbers).
 */
export async function initSentryClient(): Promise<void> {
  if (typeof window === 'undefined') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0, // replay opt-in futuro
    replaysOnErrorSampleRate: 0,
  });
}
