import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { CertExpirationService } from './cert-expiration.service';
import { QUEUE_NAMES } from '../queue/queue.config';

/**
 * CertExpirationProcessor — BullMQ worker para a fila `cert-expiration`
 * (Plan 02-05).
 *
 * Recebe jobs `sweep` agendados pelo CertExpirationScheduler diariamente
 * às 03:00 BRT (06:00 UTC). Delega a varredura ao CertExpirationService.
 *
 * Idempotência: se o cron rodar 2x no mesmo dia (ex: app reiniciou e BullMQ
 * re-disparou um job pendente), o `@@unique([certificadoId, tier])` em
 * `alertas_certificado` garante que não há duplicação no banco.
 *
 * Falha-tolerante: BullMQ retry com 3 attempts + exponential backoff (config
 * em QueueModule). Se Redis estiver down, o cron simplesmente não roda — não
 * derruba o app inteiro (T-02-05-10). Endpoints REST de leitura/resolve dos
 * alertas continuam funcionando independentemente.
 */
@Processor(QUEUE_NAMES.CERT_EXPIRATION)
export class CertExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(CertExpirationProcessor.name);

  constructor(private readonly service: CertExpirationService) {
    super();
  }

  async process(job: Job): Promise<{ processed: number; alertsCreated: number }> {
    if (job.name !== 'sweep') {
      this.logger.warn(
        `Unknown job name on ${QUEUE_NAMES.CERT_EXPIRATION}: ${job.name} — ignoring`,
      );
      return { processed: 0, alertsCreated: 0 };
    }

    this.logger.log({
      action: 'cert.expiration.job.start',
      jobId: job.id,
      attempt: job.attemptsMade,
    });

    const result = await this.service.runOnce();

    this.logger.log({
      action: 'cert.expiration.job.done',
      jobId: job.id,
      processed: result.processed,
      alertsCreated: result.alertsCreated,
    });

    return result;
  }
}
