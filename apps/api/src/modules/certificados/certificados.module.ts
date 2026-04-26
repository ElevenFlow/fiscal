import { Module } from '@nestjs/common';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';
import { PfxParserService } from './pfx-parser.service';

/**
 * CertificadosModule — pipeline E2E do Certificado A1 (Phase 2 Plan 02-04).
 *
 * Endpoints sob /api/certificados; depende de StorageModule (Global) que
 * provê S3Service + KmsEnvelopeService.
 *
 * Exporta CertificadosService para que Wave 3 (cron alertas) e Phase 3
 * (emissão) possam injetar e chamar `assertCertificadoValido(empresaId)`.
 */
@Module({
  controllers: [CertificadosController],
  providers: [CertificadosService, PfxParserService],
  exports: [CertificadosService],
})
export class CertificadosModule {}
