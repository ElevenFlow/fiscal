import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from '@aws-sdk/client-kms';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { BusinessException } from '../../common/business.exception';

/**
 * KmsEnvelopeService — KMS envelope encryption para o pipeline do Certificado A1
 * (Phase 2 Plan 02-04).
 *
 * Pattern (defesa em camadas):
 *  1. DEK aleatória de 32 bytes via `KMS:GenerateDataKey` (KeySpec=AES_256)
 *     com `EncryptionContext={tenantId, purpose:'pfx'}` — KMS atrela esse
 *     contexto à DEK cifrada; tentativas de Decrypt com contexto diferente
 *     falham (T-02-04-04 — context tampering).
 *  2. AES-256-GCM cifra o `.pfx` com a DEK em claro; saída = `IV(12) | TAG(16) | CT(N)`.
 *  3. Persiste APENAS a DEK cifrada + ciphertext; a DEK em claro é zerada
 *     em `finally` block (best-effort wipe).
 *
 * Dev fallback (`KMS_CERT_KEY_ID` vazio):
 *  - Usa `DEV_MASTER_KEY` (32 bytes hex) para derivar uma wrapping key via
 *    HMAC-SHA256(masterKey, `${tenantId}|${purpose}`).
 *  - "Cifra" a DEK fazendo XOR com a wrapping key. Round-trip funciona,
 *    e tampering do encryption context produz wrapping key diferente,
 *    fazendo o `aes-gcm` decrypt falhar com auth tag inválido — mantém o
 *    invariant de segurança em dev sem precisar de LocalStack/KMS real.
 *  - Boot loga warning explícito; em production/staging, recusa-se a iniciar
 *    (T-02-04-12 — fail-closed).
 */

export interface EnvelopeEncryptionContext {
  tenantId: string;
  purpose: 'pfx';
}

export interface EncryptedEnvelope {
  /** Bytes cifrados em formato `IV(12) | TAG(16) | CT(N)` (AES-256-GCM). */
  ciphertext: Buffer;
  /** DEK cifrada — pelo KMS em prod, ou wrapping HMAC-derived em dev. */
  encryptedDek: Buffer;
  /** Identificador da CMK que cifrou a DEK; em dev é literal `dev-fallback`. */
  kmsKeyId: string;
}

@Injectable()
export class KmsEnvelopeService implements OnModuleInit {
  private readonly logger = new Logger(KmsEnvelopeService.name);
  private kmsClient: KMSClient | null = null;
  private readonly kmsKeyId: string;
  private readonly devMasterKey: Buffer | null;

  constructor() {
    this.kmsKeyId = process.env.KMS_CERT_KEY_ID ?? '';
    const dev = process.env.DEV_MASTER_KEY;
    this.devMasterKey = dev && dev.length === 64 ? Buffer.from(dev, 'hex') : null;
  }

  onModuleInit(): void {
    const isProd =
      process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

    if (this.kmsKeyId) {
      this.kmsClient = new KMSClient({
        region: process.env.AWS_REGION ?? 'sa-east-1',
      });
      this.logger.log(
        `KmsEnvelopeService init — using AWS KMS (keyId=${this.kmsKeyId}, region=${process.env.AWS_REGION ?? 'sa-east-1'})`,
      );
      return;
    }

    if (isProd) {
      // T-02-04-12: fail-closed — sem CMK em prod/staging é incidente de configuração.
      throw new Error(
        'KMS_CERT_KEY_ID is required in production/staging — refusing to boot without real CMK',
      );
    }

    if (!this.devMasterKey) {
      this.logger.warn(
        '[KMS DEV FALLBACK] KMS_CERT_KEY_ID is empty AND DEV_MASTER_KEY is not set or invalid (must be 64 hex chars = 32 bytes). ' +
          'Certificate uploads WILL FAIL until you set one of them. ' +
          'For local dev: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" → DEV_MASTER_KEY=...',
      );
      return;
    }

    this.logger.warn(
      '[KMS DEV FALLBACK] Using HMAC-SHA256 derived wrapping keys from DEV_MASTER_KEY. ' +
        'NEVER use this in production — set KMS_CERT_KEY_ID to a real CMK in sa-east-1.',
    );
  }

  async encryptEnvelope(
    plaintext: Buffer,
    ctx: EnvelopeEncryptionContext,
  ): Promise<EncryptedEnvelope> {
    this.assertCtxValid(ctx);
    const { dek, encryptedDek, kmsKeyId } = await this.generateDek(ctx);
    try {
      const ciphertext = this.aesGcmEncrypt(dek, plaintext);
      return { ciphertext, encryptedDek, kmsKeyId };
    } finally {
      // Best-effort wipe — Buffer.fill(0) zera o backing store mesmo quando
      // o GC ainda não recolheu. Não impede heap dump em janela curta, mas
      // reduz a superfície (T-02-04-06).
      dek.fill(0);
    }
  }

  async decryptEnvelope(
    ciphertext: Buffer,
    encryptedDek: Buffer,
    ctx: EnvelopeEncryptionContext,
  ): Promise<Buffer> {
    this.assertCtxValid(ctx);
    const dek = await this.decryptDek(encryptedDek, ctx);
    try {
      return this.aesGcmDecrypt(dek, ciphertext);
    } finally {
      dek.fill(0);
    }
  }

  private assertCtxValid(ctx: EnvelopeEncryptionContext): void {
    if (!ctx || !ctx.tenantId || ctx.purpose !== 'pfx') {
      throw new BusinessException(
        'INVALID_ENCRYPTION_CONTEXT',
        'tenantId + purpose:pfx required for envelope encryption',
        400,
      );
    }
  }

  private async generateDek(
    ctx: EnvelopeEncryptionContext,
  ): Promise<{ dek: Buffer; encryptedDek: Buffer; kmsKeyId: string }> {
    if (this.kmsClient && this.kmsKeyId) {
      const cmd = new GenerateDataKeyCommand({
        KeyId: this.kmsKeyId,
        KeySpec: 'AES_256',
        EncryptionContext: this.toKmsContext(ctx),
      });
      const out = await this.kmsClient.send(cmd);
      if (!out.Plaintext || !out.CiphertextBlob) {
        throw new Error('KMS GenerateDataKey returned empty Plaintext or CiphertextBlob');
      }
      return {
        dek: Buffer.from(out.Plaintext),
        encryptedDek: Buffer.from(out.CiphertextBlob),
        kmsKeyId: this.kmsKeyId,
      };
    }

    // DEV FALLBACK
    if (!this.devMasterKey) {
      throw new BusinessException(
        'KMS_NOT_CONFIGURED',
        'KMS not configured (set KMS_CERT_KEY_ID or DEV_MASTER_KEY)',
        500,
      );
    }
    const dek = randomBytes(32);
    const wrappingKey = this.deriveDevWrappingKey(ctx);
    const encryptedDek = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      // Buffer indexing returns number | undefined under noUncheckedIndexedAccess;
      // os Buffers acima são alocados/preenchidos com 32 bytes, índice 0..31 é seguro.
      encryptedDek[i] = (dek[i] as number) ^ (wrappingKey[i] as number);
    }
    return { dek, encryptedDek, kmsKeyId: 'dev-fallback' };
  }

  private async decryptDek(
    encryptedDek: Buffer,
    ctx: EnvelopeEncryptionContext,
  ): Promise<Buffer> {
    if (this.kmsClient && this.kmsKeyId) {
      const out = await this.kmsClient.send(
        new DecryptCommand({
          CiphertextBlob: encryptedDek,
          EncryptionContext: this.toKmsContext(ctx),
        }),
      );
      if (!out.Plaintext) {
        throw new Error('KMS Decrypt returned empty Plaintext');
      }
      return Buffer.from(out.Plaintext);
    }
    if (!this.devMasterKey) {
      throw new BusinessException(
        'KMS_NOT_CONFIGURED',
        'KMS not configured (set KMS_CERT_KEY_ID or DEV_MASTER_KEY)',
        500,
      );
    }
    if (encryptedDek.length !== 32) {
      throw new Error('Dev fallback expects 32-byte encryptedDek');
    }
    const wrappingKey = this.deriveDevWrappingKey(ctx);
    const dek = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      dek[i] = (encryptedDek[i] as number) ^ (wrappingKey[i] as number);
    }
    return dek;
  }

  private deriveDevWrappingKey(ctx: EnvelopeEncryptionContext): Buffer {
    if (!this.devMasterKey) {
      throw new Error('DEV_MASTER_KEY missing');
    }
    return createHmac('sha256', this.devMasterKey)
      .update(`${ctx.tenantId}|${ctx.purpose}`)
      .digest();
  }

  private toKmsContext(ctx: EnvelopeEncryptionContext): Record<string, string> {
    return { tenantId: ctx.tenantId, purpose: ctx.purpose };
  }

  private aesGcmEncrypt(key: Buffer, plaintext: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]);
  }

  private aesGcmDecrypt(key: Buffer, blob: Buffer): Buffer {
    if (blob.length < 28) {
      throw new Error('Ciphertext too short (< 28 bytes — missing IV/tag)');
    }
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const ct = blob.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }
}
