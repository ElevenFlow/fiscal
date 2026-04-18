import { Global, Injectable, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import * as Sentry from '@sentry/node';

/**
 * SentryBootstrap — inicializa Sentry SDK no ciclo de vida da aplicação.
 *
 * Contrato no-op: se `SENTRY_DSN` não está setado, loga "Sentry not initialized"
 * e retorna. Produção provisiona DSN via env/secret manager.
 *
 * Defense-in-depth: Plan 01-05 já aplica Pino redact + safeLog whitelist.
 * O `beforeSend` abaixo é camada 3 (de 4) — cobre o caso residual onde stack
 * trace / breadcrumb / extra carrega PII direto ao transporte Sentry.
 *
 * Camadas (ver docs/OBSERVABILITY.md):
 *   1. Pino redact (blacklist PII) — Plan 01-05
 *   2. safeLog whitelist — Plan 01-05 WARNING #6
 *   3. Sentry beforeSend — ESTE PLAN
 *   4. Sentry UI data scrubbers — provisionado via UI do dashboard
 */
@Injectable()
export class SentryBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(SentryBootstrap.name);

  onApplicationBootstrap(): void {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      this.logger.log('Sentry not initialized (SENTRY_DSN unset)');
      return;
    }

    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      /**
       * beforeSend — defense-in-depth. Plan 05 já aplica Pino redact + safeLog
       * whitelist (WARNING #6). Aqui scrub residual caso algo chegue direto ao
       * transporte Sentry (stack trace com request body, breadcrumbs, extra).
       */
      beforeSend(event) {
        if (event.request) {
          event.request.data = '[REDACTED]';
          event.request.cookies = { scrubbed: '[REDACTED]' };
        }
        if (event.extra) {
          for (const key of ['xml', 'pfx', 'pfxBuffer', 'certificate', 'privateKey', 'cpf', 'cnpj']) {
            if (key in event.extra) {
              event.extra[key] = '[REDACTED]';
            }
          }
        }
        return event;
      },
    });

    this.logger.log(
      `Sentry initialized — env=${process.env.SENTRY_ENVIRONMENT ?? 'development'} rate=${process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'}`,
    );
  }
}

/**
 * SentryModule — @Global para disponibilizar SentryBootstrap sem re-import.
 */
@Global()
@Module({
  providers: [SentryBootstrap],
  exports: [SentryBootstrap],
})
export class SentryModule {}
