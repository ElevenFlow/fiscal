import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from '../queue/queue.config';
import { CertExpirationProcessor } from './cert-expiration.processor';
import { CertExpirationScheduler } from './cert-expiration.scheduler';
import { CertExpirationService } from './cert-expiration.service';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';
import { PfxParserService } from './pfx-parser.service';

const hasRedis = Boolean(process.env.REDIS_URL);

/**
 * CertificadosModule — pipeline E2E do Certificado A1 + cron de alertas
 * (Phase 2 Plans 02-04 + 02-05).
 *
 * Endpoints sob /api/certificados; depende de StorageModule (Global) que
 * provê S3Service + KmsEnvelopeService.
 *
 * Plan 02-05 adiciona:
 *  - CertExpirationService — varre certificados ativos e gera alertas
 *  - CertExpirationProcessor — BullMQ worker da fila 'cert-expiration'
 *  - CertExpirationScheduler — registra cron repeatable diário 03:00 BRT
 *
 * BullModule.registerQueue('cert-expiration') é redundante com QueueModule
 * mas necessário aqui para que `@InjectQueue('cert-expiration')` no
 * scheduler resolva localmente — pattern recomendado pela doc oficial do
 * @nestjs/bullmq quando a fila é consumida em feature module.
 *
 * Exporta CertificadosService + CertExpirationService para que Phase 3
 * (emissão) e Phase 6 (Central de Alertas) possam injetar.
 */
@Module({
  imports: hasRedis ? [BullModule.registerQueue({ name: QUEUE_NAMES.CERT_EXPIRATION })] : [],
  controllers: [CertificadosController],
  providers: [
    CertificadosService,
    PfxParserService,
    CertExpirationService,
    ...(hasRedis ? [CertExpirationProcessor, CertExpirationScheduler] : []),
  ],
  exports: [CertificadosService, CertExpirationService],
})
export class CertificadosModule {}
