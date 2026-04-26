/**
 * Tipos internos do CertificadosModule (Phase 2 Plan 02-04).
 *
 * Não há DTO Zod para o upload — multipart é processado pelo Fastify e o
 * controller passa diretamente Buffer + senha ao service. Os schemas Zod
 * em `packages/shared/src/cadastros/certificado.ts` cobrem APENAS as
 * respostas (lista/detalhe), que o FE consome via Route Handler proxy.
 */

export interface UploadCertificateInput {
  pfxBytes: Buffer;
  password: string;
}
