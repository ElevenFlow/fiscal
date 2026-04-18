import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service.js';
import { ObjectLockVerifier } from './object-lock-verifier.js';

/**
 * StorageModule — provê S3Service tipado para toda a aplicação (Global).
 *
 * FOUND-11: ObjectLockVerifier roda no bootstrap e confirma que o bucket
 * fiscal em produção tem Object Lock Compliance Mode com retenção >= 6 anos.
 * Com STRICT_OBJECT_LOCK=true, uma configuração inválida aborta o startup.
 */
@Global()
@Module({
  providers: [S3Service, ObjectLockVerifier],
  exports: [S3Service],
})
export class StorageModule {}
