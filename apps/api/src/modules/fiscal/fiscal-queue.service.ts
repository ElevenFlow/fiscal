import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BusinessException } from '../../common/business.exception';
import { QUEUE_NAMES } from '../queue/queue.config';
import { FiscalEmissionService } from './fiscal-emission.service';

export type FiscalEmissionJob = {
  notaFiscalId: string;
};

@Injectable()
export class FiscalQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.FISCAL_EMISSION) private readonly queue: Queue<FiscalEmissionJob>,
  ) {}

  async enqueueEmission(notaFiscalId: string): Promise<{ queued: true; jobId: string | undefined }> {
    const job = await this.queue.add(
      'emit-nfe',
      { notaFiscalId },
      {
        jobId: `nfe:${notaFiscalId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    );
    return { queued: true, jobId: job.id };
  }
}

@Injectable()
export class FiscalNoopQueueService {
  constructor(private readonly emission: FiscalEmissionService) {}

  async enqueueEmission(notaFiscalId: string): Promise<{ queued: false; result: unknown }> {
    const result = await this.emission.processEmission(notaFiscalId);
    return { queued: false, result };
  }
}

export function assertFiscalQueueConfigured(): void {
  if (!process.env.REDIS_URL) {
    throw new BusinessException(
      'FISCAL_QUEUE_INLINE_MODE',
      'REDIS_URL ausente: emissao executada inline neste ambiente.',
      202,
    );
  }
}
