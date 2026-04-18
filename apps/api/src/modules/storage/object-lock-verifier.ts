import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  S3Client,
  GetObjectLockConfigurationCommand,
  type ObjectLockEnabled,
} from '@aws-sdk/client-s3';

/**
 * Verifica que o bucket de fiscal em produção tem Object Lock COMPLIANCE com retenção
 * de 6 anos. Roda no bootstrap; em produção falha fechado se env STRICT_OBJECT_LOCK=true.
 *
 * FOUND-11: todos arquivos fiscais em S3 Object Lock Compliance Mode com retenção 6 anos.
 * PITFALLS.md #7: retenção fiscal 5 anos é exigência legal; margem de 6 anos.
 *
 * Modos de operação:
 * - NODE_ENV != production && STRICT_OBJECT_LOCK != 'true' → skip + log (dev mode).
 * - NODE_ENV == production (ou STRICT_OBJECT_LOCK='true') →
 *     - Credenciais AWS ausentes / bucket não seteado → failOrWarn
 *     - GetObjectLockConfiguration falha → failOrWarn
 *     - Mode != COMPLIANCE ou years < 6 → failOrWarn
 *     - failOrWarn: STRICT=true → THROW (aborta bootstrap); senão → Logger.warn
 */
@Injectable()
export class ObjectLockVerifier implements OnApplicationBootstrap {
  private readonly logger = new Logger(ObjectLockVerifier.name);

  async onApplicationBootstrap(): Promise<void> {
    const env = process.env.NODE_ENV ?? 'development';
    const strict = process.env.STRICT_OBJECT_LOCK === 'true';

    if (env !== 'production' && !strict) {
      this.logger.log(
        `Skipping Object Lock verification (NODE_ENV=${env}, STRICT_OBJECT_LOCK=${strict})`,
      );
      return;
    }

    // Em dev/test, credenciais podem ser placeholders (REPLACE_ME); só não abortamos porque
    // acima já retornamos. A partir daqui estamos em prod OU STRICT=true — exigimos creds reais.
    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_ACCESS_KEY_ID === 'REPLACE_ME'
    ) {
      this.failOrWarn(
        'AWS_ACCESS_KEY_ID not configured (prod requires real IAM credentials or instance role)',
      );
      return;
    }

    await this.verifyBucket(
      process.env.S3_BUCKET_FISCAL ?? '',
      'COMPLIANCE',
      6,
    );
  }

  async verifyBucket(
    bucket: string,
    expectedMode: string,
    expectedYears: number,
  ): Promise<void> {
    if (!bucket) {
      const msg = `S3_BUCKET_FISCAL not set`;
      this.failOrWarn(msg);
      return;
    }

    const client = new S3Client({
      region: process.env.AWS_REGION ?? 'sa-east-1',
    });

    try {
      const result = await client.send(
        new GetObjectLockConfigurationCommand({ Bucket: bucket }),
      );
      const config = result.ObjectLockConfiguration;
      const enabled: ObjectLockEnabled | undefined = config?.ObjectLockEnabled;
      const mode = config?.Rule?.DefaultRetention?.Mode;
      const years = config?.Rule?.DefaultRetention?.Years;

      if (enabled !== 'Enabled') {
        this.failOrWarn(`Bucket ${bucket}: Object Lock NOT enabled`);
        return;
      }
      if (mode !== expectedMode) {
        this.failOrWarn(
          `Bucket ${bucket}: Object Lock mode=${mode}, expected ${expectedMode}`,
        );
        return;
      }
      if ((years ?? 0) < expectedYears) {
        this.failOrWarn(
          `Bucket ${bucket}: Object Lock retention=${years} years, expected >= ${expectedYears}`,
        );
        return;
      }

      this.logger.log(
        `Bucket ${bucket}: Object Lock OK — mode=${mode}, retention=${years} years`,
      );
    } catch (err) {
      this.failOrWarn(
        `Failed to get Object Lock config for ${bucket}: ${(err as Error).message}`,
      );
    }
  }

  private failOrWarn(msg: string): void {
    if (process.env.STRICT_OBJECT_LOCK === 'true') {
      throw new Error(`[ObjectLockVerifier FATAL] ${msg}`);
    }
    this.logger.warn(`[ObjectLockVerifier] ${msg}`);
  }
}
