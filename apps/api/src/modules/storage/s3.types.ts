/**
 * Tipos compartilhados do StorageModule.
 */

export type FiscalDocumentKind =
  | 'nfe_autorizada'
  | 'nfse_autorizada'
  | 'danfe'
  | 'danfse'
  | 'xml_importado'
  | 'xml_rejeitado';

export interface UploadFiscalDocumentInput {
  tenantId: string;
  chaveAcesso: string;
  kind: FiscalDocumentKind;
  bytes: Buffer;
  contentType: string;
  /** Override de retenção; default = now + 6 anos. */
  retentionOverride?: Date;
}

export interface UploadFiscalDocumentResult {
  key: string;
  versionId: string;
  retentionUntil: Date;
}

export interface UploadCertificateInput {
  tenantId: string;
  certId: string;
  /** Já cifrado via KMS envelope encryption (responsabilidade do caller em Phase 2). */
  encryptedBytes: Buffer;
  fingerprint: string;
}

export interface UploadCertificateResult {
  key: string;
  versionId: string;
}

/**
 * Constroi o prefixo de tenant para organização lógica do bucket.
 * Ex: tenants/33333333-3333-3333-3333-333333333333/xml/emitidos/...
 */
export function tenantPrefix(tenantId: string): string {
  return `tenants/${tenantId}`;
}
