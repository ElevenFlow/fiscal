import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queue.config';
import { FiscalEmissionService } from './fiscal-emission.service';
import type { FiscalEmissionJob } from './fiscal-queue.service';

@Processor(QUEUE_NAMES.FISCAL_EMISSION)
export class FiscalEmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(FiscalEmissionProcessor.name);

  constructor(private readonly emission: FiscalEmissionService) {
    super();
  }

  async process(job: Job<FiscalEmissionJob>): Promise<unknown> {
    if (job.name !== 'emit-nfe') {
      this.logger.warn(`Ignoring unknown fiscal job: ${job.name}`);
      return null;
    }
    this.logger.log({
      action: 'nfe.emit.job.start',
      jobId: job.id,
      notaFiscalId: job.data.notaFiscalId,
      attempt: job.attemptsMade,
    });
    const result = await this.emission.processEmission(job.data.notaFiscalId);
    this.logger.log({
      action: 'nfe.emit.job.done',
      jobId: job.id,
      notaFiscalId: job.data.notaFiscalId,
    });
    return result;
  }
}
