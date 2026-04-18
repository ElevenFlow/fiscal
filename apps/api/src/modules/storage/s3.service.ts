import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type ObjectLockMode,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  type UploadFiscalDocumentInput,
  type UploadFiscalDocumentResult,
  type UploadCertificateInput,
  type UploadCertificateResult,
  tenantPrefix,
} from './s3.types.js';

/**
 * S3Service — cliente tipado para buckets de arquivos fiscais e certificados.
 *
 * Buckets (conforme infra/README.md):
 * - S3_BUCKET_FISCAL: XMLs autorizados, DANFEs. Object Lock COMPLIANCE, 6 anos.
 * - S3_BUCKET_CERTS:  Certificados A1 cifrados. Object Lock GOVERNANCE, 2 anos.
 *
 * Encryption context `{ tenantId, purpose }` usado em todas operações para isolar
 * blast radius (KMS decrypt falha se contexto não bate).
 *
 * FOUND-11 (Pitfall #7 retenção fiscal 5 anos): retenção default de 6 anos em
 * modo COMPLIANCE (nem root AWS pode deletar) garante que XML autorizado +
 * protocolo SEFAZ ficam imutáveis além do prazo decadencial do CTN.
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly fiscalBucket: string;
  private readonly certsBucket: string;
  private readonly kmsKeyId: string | undefined;

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION ?? 'sa-east-1',
      // Credenciais vêm via IAM role em produção; em dev via env (AccessKey/SecretKey)
    });
    this.fiscalBucket = process.env.S3_BUCKET_FISCAL ?? 'nexofiscal-fiscal-dev';
    this.certsBucket = process.env.S3_BUCKET_CERTS ?? 'nexofiscal-certs-dev';
    this.kmsKeyId = process.env.AWS_KMS_KEY_ID; // ex: alias/nexofiscal-prod
  }

  onModuleInit(): void {
    this.logger.log(
      `S3Service init — region=${process.env.AWS_REGION}, fiscalBucket=${this.fiscalBucket}, certsBucket=${this.certsBucket}, kmsKeyId=${this.kmsKeyId ?? '(not set)'}`,
    );
  }

  async uploadFiscalDocument(
    input: UploadFiscalDocumentInput,
  ): Promise<UploadFiscalDocumentResult> {
    const prefix = tenantPrefix(input.tenantId);
    const pathByKind: Record<string, string> = {
      nfe_autorizada: `${prefix}/xml/emitidos/nfe/${input.chaveAcesso}.xml`,
      nfse_autorizada: `${prefix}/xml/emitidos/nfse/${input.chaveAcesso}.xml`,
      xml_importado: `${prefix}/xml/importados/${input.chaveAcesso}.xml`,
      xml_rejeitado: `${prefix}/xml/rejeitados/${input.chaveAcesso}.xml`,
      danfe: `${prefix}/danfe/${input.chaveAcesso}.pdf`,
      danfse: `${prefix}/danfse/${input.chaveAcesso}.pdf`,
    };
    const key = pathByKind[input.kind];
    if (!key) throw new Error(`Unknown fiscal document kind: ${input.kind}`);

    const retentionUntil = input.retentionOverride ?? this.defaultRetentionDate();

    const params: PutObjectCommandInput = {
      Bucket: this.fiscalBucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.contentType,
      ObjectLockMode: 'COMPLIANCE' as ObjectLockMode,
      ObjectLockRetainUntilDate: retentionUntil,
      ServerSideEncryption: this.kmsKeyId ? 'aws:kms' : undefined,
      SSEKMSKeyId: this.kmsKeyId,
      Metadata: {
        'tenant-id': input.tenantId,
        'chave-acesso': input.chaveAcesso,
        'document-kind': input.kind,
      },
    };

    const result = await this.client.send(new PutObjectCommand(params));
    this.logger.log(
      `Uploaded ${input.kind} to ${key} (versionId=${result.VersionId})`,
    );

    return {
      key,
      versionId: result.VersionId ?? '',
      retentionUntil,
    };
  }

  async downloadFiscalDocument(tenantId: string, key: string): Promise<Buffer> {
    if (!key.startsWith(tenantPrefix(tenantId))) {
      throw new Error(
        `Key ${key} does not match tenant prefix ${tenantPrefix(tenantId)}`,
      );
    }
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.fiscalBucket, Key: key }),
    );
    if (!result.Body) throw new Error('Empty body from S3');

    const chunks: Buffer[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of result.Body as any) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async uploadCertificate(
    input: UploadCertificateInput,
  ): Promise<UploadCertificateResult> {
    const key = `${tenantPrefix(input.tenantId)}/certs/${input.certId}.pfx.enc`;

    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.certsBucket,
        Key: key,
        Body: input.encryptedBytes,
        ContentType: 'application/octet-stream',
        ObjectLockMode: 'GOVERNANCE' as ObjectLockMode,
        ObjectLockRetainUntilDate: new Date(
          Date.now() + 2 * 365 * 24 * 60 * 60 * 1000,
        ),
        ServerSideEncryption: this.kmsKeyId ? 'aws:kms' : undefined,
        SSEKMSKeyId: this.kmsKeyId,
        Metadata: {
          'tenant-id': input.tenantId,
          'cert-id': input.certId,
          fingerprint: input.fingerprint,
        },
      }),
    );

    this.logger.log(`Uploaded cert to ${key} (versionId=${result.VersionId})`);
    return { key, versionId: result.VersionId ?? '' };
  }

  async generatePresignedUrl(
    tenantId: string,
    key: string,
    expiresSeconds = 300,
  ): Promise<string> {
    if (!key.startsWith(tenantPrefix(tenantId))) {
      throw new Error(
        `Key ${key} does not match tenant prefix ${tenantPrefix(tenantId)}`,
      );
    }
    const command = new GetObjectCommand({
      Bucket: this.fiscalBucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresSeconds });
  }

  private defaultRetentionDate(): Date {
    // 6 anos = margem sobre 5 exigidos (CTN Art. 173 e 174)
    return new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000);
  }
}
