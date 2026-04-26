import { z } from 'zod';

/**
 * Schemas Zod compartilhados de Série Fiscal (Phase 2 Plan 02-06).
 *
 * Modelo no Prisma (Plan 02-01):
 *   SerieFiscal {
 *     id, tenantId, empresaId, modelo: 'NFE_55'|'NFSE',
 *     serie: Int, proximoNumero: BigInt,
 *     ambiente: 'HOMOLOGACAO'|'PRODUCAO',
 *     ativa: Bool, createdAt, updatedAt
 *   }
 *   @@unique([empresaId, modelo, serie])
 *
 * IMPORTANTE: `proximoNumero` é BigInt no banco — JSON.stringify(1234n) lança;
 * a resposta serializa como string (`'1234'`).
 */

export const modeloEnum = z.enum(['NFE_55', 'NFSE']);
export type SerieModelo = z.infer<typeof modeloEnum>;

export const ambienteEnum = z.enum(['HOMOLOGACAO', 'PRODUCAO']);
export type SerieAmbiente = z.infer<typeof ambienteEnum>;

export const SerieCreateSchema = z.object({
  empresaId: z.string().uuid(),
  modelo: modeloEnum,
  serie: z.coerce.number().int().min(1).max(999),
  /**
   * Próximo número a ser emitido. Default 1 (primeira NF).
   * Aceita number (até 2^53) — para empresas que migram de outro sistema
   * com numeração já avançada. Persistido como BigInt no banco.
   */
  proximoNumero: z.coerce.number().int().min(1).default(1),
  ambiente: ambienteEnum.default('HOMOLOGACAO'),
});
export type SerieCreateInput = z.infer<typeof SerieCreateSchema>;

export const SerieUpdateSchema = z.object({
  ambiente: ambienteEnum.optional(),
  ativa: z.boolean().optional(),
  // proximoNumero NÃO é editável via PATCH — apenas via emissão real
  // (helper SeriesNumberingHelper.getNextSeqAndIncrement).
});
export type SerieUpdateInput = z.infer<typeof SerieUpdateSchema>;

export const SerieListResponseItemSchema = z.object({
  id: z.string().uuid(),
  empresaId: z.string().uuid(),
  modelo: modeloEnum,
  serie: z.number().int(),
  /** BigInt serializado como string para JSON-safety. */
  proximoNumero: z.string(),
  ambiente: ambienteEnum,
  ativa: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SerieListResponseItem = z.infer<typeof SerieListResponseItemSchema>;
