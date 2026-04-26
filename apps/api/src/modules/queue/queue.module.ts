import { BullModule } from '@nestjs/bullmq';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.config';

/**
 * QueueModule — registra BullMQ globalmente no apps/api (Phase 2 Plan 02-05).
 *
 * Padrão (defesa em camadas):
 *  - `BullModule.forRootAsync` lê REDIS_URL do ConfigService — em prod aponta
 *    para ElastiCache (rediss://). Em dev usa redis://localhost:6380 (docker-compose).
 *  - Se REDIS_URL ausente, ainda registra o módulo mas com connection string
 *    fallback (redis://localhost:6380); workers/scheduler que dependem disso
 *    devem detectar a ausência via env e virar no-op (Plan 02-05 scheduler skip).
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
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6380';
        const logger = new Logger('QueueModule');
        if (!config.get<string>('REDIS_URL')) {
          logger.warn(
            'REDIS_URL not set — using fallback redis://localhost:6380. Workers/scheduler will no-op if Redis is unreachable.',
          );
        }
        return {
          connection: {
            url,
            // Reduz reconnect storm quando Redis está down em dev.
            // Em prod o ioredis já tem retry exponencial padrão.
            maxRetriesPerRequest: null, // BullMQ recommendation
          },
          defaultJobOptions: {
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 1000 },
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        };
      },
      inject: [ConfigService],
    }),
    // Registrar filas conhecidas; planos futuros podem fazer registerQueue
    // dentro dos próprios feature modules (02-08 worker NCM/CFOP).
    BullModule.registerQueue({ name: QUEUE_NAMES.CERT_EXPIRATION }),
    BullModule.registerQueue({ name: QUEUE_NAMES.LOOKUP_SYNC }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
