import { z } from 'zod';

/**
 * Schemas compartilhados do Certificado A1 (Phase 2 Plan 02-04).
 *
 * IMPORTANTE: NUNCA exporte schema que aceite `pfxBytes` ou `password` no FE.
 * Upload é multipart binário tratado pelo Route Handler proxy + apps/api;
 * Zod valida apenas a forma da resposta (metadados publicáveis no UI).
 */

export const CertificadoListItemSchema = z.object({
  id: z.string().uuid(),
  cn: z.string(),
  /** 14 dígitos (CNPJ ICP-Brasil) ou string vazia se subject não bate o padrão. */
  cnpjCertificado: z.string(),
  /** SHA-256 hex lowercase do DER do cert (64 chars). */
  fingerprint: z.string().length(64),
  /** ISO 8601 (Timestamptz no banco). */
  notBefore: z.string(),
  notAfter: z.string(),
  ativo: z.boolean(),
  createdAt: z.string(),
});
export type CertificadoListItem = z.infer<typeof CertificadoListItemSchema>;

export const CertificadoDetailSchema = CertificadoListItemSchema.extend({
  s3Key: z.string(),
  kmsKeyId: z.string(),
  uploadedById: z.string().uuid().nullable(),
});
export type CertificadoDetail = z.infer<typeof CertificadoDetailSchema>;
