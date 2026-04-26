import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { S3Service } from '../storage/s3.service';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { KmsEnvelopeService } from '../storage/kms-envelope.service';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PfxParserService } from './pfx-parser.service';
import {
  BusinessException,
  DuplicateException,
  NotFoundResourceException,
} from '../../common/business.exception';
import { getCurrentTenant } from '../../db/tenant-context';

const MAX_PFX_BYTES = 100 * 1024;

type CertificadoRow = Prisma.CertificadoDigitalGetPayload<true>;

/**
 * CertificadosService — pipeline E2E do Certificado A1 (Phase 2 Plan 02-04).
 *
 * Fluxo `uploadCertificate`:
 *  1. Valida tamanho (≤ 100KB), parsea via PfxParserService (CN, CNPJ, fingerprint, validade)
 *  2. Verifica fingerprint duplicado no tenant (T-02-04 race / re-upload)
 *  3. KmsEnvelopeService.encryptEnvelope (DEK + AES-GCM, encryption context tenantId+pfx)
 *  4. S3Service.uploadCertificate (Object Lock GOVERNANCE 2 anos — Plan 01-08)
 *  5. Transaction: deactivate prior + create new (índice parcial UNIQUE força no banco)
 *
 * Defesas em camadas:
 *  - Pino redact garante que pfxBytes/encryptedDek nunca aparecem em log estruturado (Plan 01-05)
 *  - `pfxBytes.fill(0)` em finally (T-02-04-06)
 *  - Senha apenas em memory; nunca persistida nem logada
 *  - WHERE tenantId redundante em todas queries (defense in depth + RLS no banco — Plan 02-01)
 *  - Sem DELETE físico — `deactivateCertificate` apenas seta ativo=false (S3 mantido por Object Lock)
 *
 * Helper exportado `assertCertificadoValido` é consumido por:
 *  - Wave 3 (cron alertas — Plan 02-05) para gerar alertas D-60..D-0
 *  - Phase 3 (emissão NF-e/NFS-e) como guard pré-emissão
 */
@Injectable()
export class CertificadosService {
  private readonly logger = new Logger(CertificadosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly kms: KmsEnvelopeService,
    private readonly parser: PfxParserService,
  ) {}

  async uploadCertificate(pfxBytes: Buffer, password: string): Promise<unknown> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    const userId = scope?.userId ?? null;
    if (!tenantId) {
      throw new BusinessException(
        'NO_TENANT',
        'Empresa ativa requerida para upload de certificado',
        400,
      );
    }

    if (pfxBytes.length > MAX_PFX_BYTES) {
      throw new BusinessException(
        'FILE_TOO_LARGE',
        `Arquivo .pfx excede 100KB (recebido: ${pfxBytes.length} bytes)`,
        400,
      );
    }

    try {
      // 1. Parse PKCS#12 — extrai metadados públicos
      const parsed = this.parser.parsePfx(pfxBytes, password);

      // 2. Detecta upload duplicado (mesmo fingerprint no tenant)
      const existing = await this.prisma.certificadoDigital.findFirst({
        where: { tenantId, fingerprint: parsed.fingerprint },
      });
      if (existing) {
        throw new DuplicateException('fingerprint', parsed.fingerprint);
      }

      const certId = randomUUID();

      // 3. KMS envelope encryption
      const env = await this.kms.encryptEnvelope(pfxBytes, {
        tenantId,
        purpose: 'pfx',
      });

      // 4. S3 upload (Object Lock GOVERNANCE 2 anos)
      const s3Result = await this.s3.uploadCertificate({
        tenantId,
        certId,
        encryptedBytes: env.ciphertext,
        fingerprint: parsed.fingerprint,
      });

      // 5. Transaction: deactivate prior + create new
      const created = await this.prisma.$transaction(async (tx) => {
        await tx.certificadoDigital.updateMany({
          where: { tenantId, ativo: true },
          data: { ativo: false },
        });
        return tx.certificadoDigital.create({
          data: {
            id: certId,
            tenantId,
            s3Key: s3Result.key,
            s3VersionId: s3Result.versionId,
            // Prisma Bytes espera Uint8Array<ArrayBuffer> (não ArrayBufferLike);
            // copia para fresh ArrayBuffer para satisfazer tsc strict.
            // 32 bytes (DEK cifrada) — copy é negligenciável.
            encryptedDek: Uint8Array.from(env.encryptedDek),
            kmsKeyId: env.kmsKeyId,
            cn: parsed.cn,
            cnpjCertificado: parsed.cnpjCertificado ?? '',
            fingerprint: parsed.fingerprint,
            notBefore: parsed.notBefore,
            notAfter: parsed.notAfter,
            ativo: true,
            uploadedById: userId,
          },
        });
      });

      // Log estruturado SEM bytes nem senha. Pino redact garante a malha;
      // mesmo assim, só passamos prefixos/identificadores não-secretos.
      this.logger.log({
        action: 'cert.upload',
        certId: created.id,
        tenantIdPrefix: tenantId.slice(0, 8),
        cnpjPrefix: parsed.cnpjCertificado?.slice(0, 8) ?? null,
        notAfter: parsed.notAfter.toISOString(),
        kmsKeyId: env.kmsKeyId,
      });

      return this.toDetail(created);
    } finally {
      // Best-effort wipe — Buffer alocado pelo Fastify multipart.
      // Buffer.fill(0) zero-eira o backing store, reduzindo janela de heap dump.
      try {
        pfxBytes.fill(0);
      } catch {
        // ignore — Buffer pode estar congelado em alguns adapters
      }
    }
  }

  async listCertificates(): Promise<unknown[]> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    if (!tenantId) return [];
    const rows = await this.prisma.certificadoDigital.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toListItem(r));
  }

  async getCertificate(id: string): Promise<unknown> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    const cert = await this.prisma.certificadoDigital.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!cert) throw new NotFoundResourceException('certificado', id);
    return this.toDetail(cert);
  }

  async deactivateCertificate(id: string): Promise<void> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    const cert = await this.prisma.certificadoDigital.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!cert) throw new NotFoundResourceException('certificado', id);
    await this.prisma.certificadoDigital.update({
      where: { id },
      data: { ativo: false },
    });
  }

  /**
   * Helper de defesa exportado para Wave 3 (alertas) e Phase 3 (emissão).
   *
   * Lança:
   *  - CERT_NOT_FOUND (412) — empresa sem certificado ativo
   *  - CERT_EXPIRED (412)   — cert ativo, mas notAfter < now()
   *
   * Retorna a linha completa (`CertificadoDigital`) quando válido — caller
   * pode usar `s3Key` + `encryptedDek` + `kmsKeyId` para descifrar e usar
   * em assinatura XMLDSig (Phase 3).
   */
  async assertCertificadoValido(empresaId: string): Promise<CertificadoRow> {
    const cert = await this.prisma.certificadoDigital.findFirst({
      where: { tenantId: empresaId, ativo: true },
    });
    if (!cert) {
      throw new BusinessException(
        'CERT_NOT_FOUND',
        'Empresa não tem certificado A1 ativo — faça upload em Configurações.',
        412,
      );
    }
    if (cert.notAfter.getTime() < Date.now()) {
      throw new BusinessException(
        'CERT_EXPIRED',
        'Certificado A1 vencido. Renove para emitir notas fiscais.',
        412,
        {
          notAfter: cert.notAfter.toISOString(),
          certId: cert.id,
        },
      );
    }
    return cert;
  }

  private toListItem(cert: CertificadoRow): Record<string, unknown> {
    return {
      id: cert.id,
      cn: cert.cn,
      cnpjCertificado: cert.cnpjCertificado,
      fingerprint: cert.fingerprint,
      notBefore: cert.notBefore.toISOString(),
      notAfter: cert.notAfter.toISOString(),
      ativo: cert.ativo,
      createdAt: cert.createdAt.toISOString(),
    };
  }

  private toDetail(cert: CertificadoRow): Record<string, unknown> {
    return {
      ...this.toListItem(cert),
      s3Key: cert.s3Key,
      kmsKeyId: cert.kmsKeyId,
      uploadedById: cert.uploadedById,
      // CRITICAL: NUNCA inclua `encryptedDek` aqui. Mesmo cifrada, vaza
      // metadata que não tem valor para o FE.
    };
  }
}
