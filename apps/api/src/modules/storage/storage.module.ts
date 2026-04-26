import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { ObjectLockVerifier } from './object-lock-verifier.js';
import { KmsEnvelopeService } from './kms-envelope.service';

/**
 * StorageModule — provê S3Service tipado para toda a aplicação (Global).
 *
 * FOUND-11: ObjectLockVerifier roda no bootstrap e confirma que o bucket
 * fiscal em produção tem Object Lock Compliance Mode com retenção >= 6 anos.
 * Com STRICT_OBJECT_LOCK=true, uma configuração inválida aborta o startup.
 *
 * Plan 02-04: KmsEnvelopeService adicionado para envelope encryption do .pfx
 * (DEK aleatória + KMS GenerateDataKey + AES-256-GCM). Consumido pelo
 * CertificadosModule (Phase 2 cert pipeline).
 */
@Global()
@Module({
  providers: [S3Service, ObjectLockVerifier, KmsEnvelopeService],
  exports: [S3Service, KmsEnvelopeService],
})
export class StorageModule {}
