import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.config';

const hasRedis = Boolean(process.env.REDIS_URL);

const queueImports = hasRedis
  ? [
      BullModule.forRootAsync({
        useFactory: (config: ConfigService) => ({
          connection: {
            url: config.getOrThrow<string>('REDIS_URL'),
            maxRetriesPerRequest: null, // BullMQ recommendation
          },
          defaultJobOptions: {
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 1000 },
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        }),
        inject: [ConfigService],
      }),
      BullModule.registerQueue({ name: QUEUE_NAMES.CERT_EXPIRATION }),
      BullModule.registerQueue({ name: QUEUE_NAMES.FISCAL_EMISSION }),
      BullModule.registerQueue({ name: QUEUE_NAMES.LOOKUP_SYNC }),
    ]
  : [];

/**
 * QueueModule — registra BullMQ globalmente no apps/api (Phase 2 Plan 02-05).
 *
 * Padrão (defesa em camadas):
 *  - `BullModule.forRootAsync` lê REDIS_URL do ConfigService — em prod aponta
 *    para ElastiCache (rediss://). Em dev usa redis://localhost:6380 (docker-compose).
 *  - Se REDIS_URL ausente, nao registra BullMQ. Isso permite o deploy serverless
 *    provisório na Vercel sem tentar conectar em localhost:6380.
 *  - `defaultJobOptions`: removeOnComplete=100 / removeOnFail=1000 previne
 *    OOM do Redis (T-02-05-03).
 *  - 3 attempts + exponential backoff 5s base — alinha com Pitfall #19 (gateway
 *    fiscal pode dar 5xx transitório).
 *
 * Filas registradas (BullModule.registerQueue):
 *  - cert-expiration (Plan 02-05) — cron de alertas certificado A1.
 *
 * Planos futuros (02-08, Phase 3+) adicionam mais filas reutilizando este
 * mesmo módulo — `forRootAsync` é singleton; só `registerQueue` precisa
 * acontecer no module owner.
 */
@Global()
@Module({
  imports: queueImports,
  exports: hasRedis ? [BullModule] : [],
})
export class QueueModule {}
