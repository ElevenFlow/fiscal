import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { QUEUE_NAMES, SCHEDULER_JOB_IDS } from '../queue/queue.config';

/**
 * LookupSyncScheduler — registra o cron repeatable da fila `lookup-sync`
 * no boot do app (Plan 02-08).
 *
 * Cron: `'0 7 5 * *'` UTC = **04:00 America/Sao_Paulo no dia 5 de cada mês**
 * (sa-east-1 fixo -03:00). Brasil aboliu o horário de verão em 2019 — offset
 * estável; passamos `tz: 'America/Sao_Paulo'` como defesa.
 *
 * Idempotência:
 *  - `jobId: 'lookup-sync-monthly'` (constante em queue.config) — BullMQ
 *    dedup pelo jobId; reagendamento (ex: app restart) NÃO cria 2º cron.
 *  - `upsertJobScheduler` (BullMQ 5.30+) é a forma recomendada moderna; se
 *    versão instalada for < 5.30, fallback para `queue.add` com `repeat`.
 *
 * Skip em test (`NODE_ENV=test`): o cron real bagunçaria a suite — testes
 * disparam manualmente via `service.syncAll()`.
 *
 * Skip se REDIS_URL ausente: modo dev sem Redis — log warning e segue sem
 * agendar. Endpoints REST `/api/lookup/*` continuam funcionando (dados
 * vieram via seed bootstrap).
 *
 * Try/catch envelopa tudo: falha no scheduler NÃO derruba o app (T-02-08-04).
 */
@Injectable()
export class LookupSyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(LookupSyncScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.LOOKUP_SYNC) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv === 'test') {
      this.logger.log('Skipping lookup-sync scheduler in NODE_ENV=test');
      return;
    }

    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — lookup-sync scheduler disabled (no-op mode). Endpoints REST /api/lookup/* continuam funcionando, mas o cron mensal não roda.',
      );
      return;
    }

    try {
      const queueWithScheduler = this.queue as Queue & {
        upsertJobScheduler?: (
          schedulerId: string,
          repeatOpts: { pattern: string; tz?: string },
          template: { name: string; data: Record<string, unknown> },
        ) => Promise<unknown>;
      };
      if (typeof queueWithScheduler.upsertJobScheduler === 'function') {
        await queueWithScheduler.upsertJobScheduler(
          SCHEDULER_JOB_IDS.LOOKUP_SYNC_MONTHLY,
          { pattern: '0 7 5 * *', tz: 'America/Sao_Paulo' },
          { name: 'sync', data: {} },
        );
      } else {
        // Fallback BullMQ < 5.30
        await this.queue.add(
          'sync',
          {},
          {
            repeat: { pattern: '0 7 5 * *', tz: 'America/Sao_Paulo' },
            jobId: SCHEDULER_JOB_IDS.LOOKUP_SYNC_MONTHLY,
          },
        );
      }

      this.logger.log(
        `Scheduled monthly lookup-sync: '0 7 5 * *' UTC (04:00 America/Sao_Paulo on day 5) — jobId=${SCHEDULER_JOB_IDS.LOOKUP_SYNC_MONTHLY}`,
      );
    } catch (err) {
      // Falha no agendamento NÃO derruba o app — cron é não-crítico, dados
      // estão na tabela via seed bootstrap; sync mensal só atualiza descrições.
      this.logger.error({
        action: 'lookup.sync.scheduler.bootstrap.failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
