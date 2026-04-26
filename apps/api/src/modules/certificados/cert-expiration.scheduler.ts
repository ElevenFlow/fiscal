import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES, SCHEDULER_JOB_IDS } from '../queue/queue.config';

/**
 * CertExpirationScheduler — registra o cron repeatable da fila `cert-expiration`
 * no boot do app (Plan 02-05).
 *
 * Cron: `'0 6 * * *'` UTC = **03:00 America/Sao_Paulo** (sa-east-1 fixo -03:00).
 * Brasil aboliu o horário de verão em 2019 (Decreto 9.772/2019) — o offset é
 * estável, então cron UTC funciona sem TZ explícita. Mesmo assim, passamos
 * `tz: 'America/Sao_Paulo'` como defesa caso o decreto seja revertido.
 *
 * Idempotência:
 *  - `jobId: 'cert-expiration-daily'` (constante em queue.config) — BullMQ
 *    dedup pelo jobId; reagendamento (ex: app restart) NÃO cria 2º cron.
 *  - `upsertJobScheduler` (BullMQ 5.30+) é a forma recomendada moderna; se
 *    versão instalada for < 5.30, fallback para `queue.add` com `repeat`.
 *
 * Skip em test (`NODE_ENV=test`): o cron real bagunçaria a suite — testes
 * disparam manualmente via `service.runOnce()` (Plan 02-05 must_haves).
 *
 * Skip se REDIS_URL ausente: modo dev sem Redis — log warning e segue sem
 * agendar. Endpoints REST continuam funcionando; só o cron está off.
 */
@Injectable()
export class CertExpirationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(CertExpirationScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.CERT_EXPIRATION) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv === 'test') {
      this.logger.log('Skipping cert-expiration scheduler in NODE_ENV=test');
      return;
    }

    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — cert-expiration scheduler disabled (no-op mode). Endpoints REST de alertas continuam funcionando, mas o cron diário não roda.',
      );
      return;
    }

    try {
      // BullMQ 5.30+ — upsertJobScheduler substitui o legacy
      // `queue.add(name, data, { repeat, jobId })`. É idempotente por design.
      const queueWithScheduler = this.queue as Queue & {
        upsertJobScheduler?: (
          schedulerId: string,
          repeatOpts: { pattern: string; tz?: string },
          template: { name: string; data: Record<string, unknown> },
        ) => Promise<unknown>;
      };
      if (typeof queueWithScheduler.upsertJobScheduler === 'function') {
        await queueWithScheduler.upsertJobScheduler(
          SCHEDULER_JOB_IDS.CERT_EXPIRATION_DAILY,
          { pattern: '0 6 * * *', tz: 'America/Sao_Paulo' },
          { name: 'sweep', data: {} },
        );
      } else {
        // Fallback BullMQ < 5.30 — `repeat` + `jobId` (deprecated mas funcional).
        await this.queue.add(
          'sweep',
          {},
          {
            repeat: { pattern: '0 6 * * *', tz: 'America/Sao_Paulo' },
            jobId: SCHEDULER_JOB_IDS.CERT_EXPIRATION_DAILY,
          },
        );
      }

      this.logger.log(
        `Scheduled daily cert-expiration sweep: '0 6 * * *' UTC (03:00 America/Sao_Paulo) — jobId=${SCHEDULER_JOB_IDS.CERT_EXPIRATION_DAILY}`,
      );
    } catch (err) {
      // Falha no agendamento NÃO derruba o app — o cron é não-crítico e os
      // endpoints REST continuam funcionando. Log estruturado para Sentry pegar.
      this.logger.error({
        action: 'cert.expiration.scheduler.bootstrap.failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
