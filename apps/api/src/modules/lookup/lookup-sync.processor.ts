import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.config';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { LookupSyncService, type SyncResult } from './lookup-sync.service';

/**
 * LookupSyncProcessor — BullMQ worker para a fila `lookup-sync` (Plan 02-08).
 *
 * Recebe jobs `sync` agendados pelo LookupSyncScheduler mensalmente (dia 5
 * às 04:00 BRT = 07:00 UTC). Delega ao LookupSyncService.syncAll().
 *
 * Idempotência: o syncAll usa INSERT ... ON CONFLICT DO UPDATE — re-runs
 * no mesmo dia atualizam atualizado_em sem duplicar.
 *
 * Falha-tolerante: BullMQ retry com 3 attempts + exponential backoff (config
 * em QueueModule). Falha em uma source não derruba o app — syncAll trata
 * try/catch por source.
 */
@Processor(QUEUE_NAMES.LOOKUP_SYNC)
export class LookupSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(LookupSyncProcessor.name);

  constructor(private readonly service: LookupSyncService) {
    super();
  }

  async process(job: Job): Promise<SyncResult | null> {
    if (job.name !== 'sync') {
      this.logger.warn(
        `Unknown job name on ${QUEUE_NAMES.LOOKUP_SYNC}: ${job.name} — ignoring`,
      );
      return null;
    }

    this.logger.log({
      action: 'lookup.sync.job.start',
      jobId: job.id,
      attempt: job.attemptsMade,
    });

    const result = await this.service.syncAll();

    this.logger.log({
      action: 'lookup.sync.job.done',
      jobId: job.id,
      ncm: result.ncm,
      cest: result.cest,
      cfop: result.cfop,
      lc116: result.lc116,
      failureCount: result.failures.length,
    });

    return result;
  }
}
