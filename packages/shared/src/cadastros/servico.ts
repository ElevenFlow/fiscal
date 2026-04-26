import { z } from 'zod';
import { PaginationQuerySchema } from './common';

/**
 * Schemas Zod — Servico (Phase 2 Plan 02-02).
 * Espelha apps/api/prisma/schema.prisma model Servico.
 *
 * Notas:
 *  - codigoInterno: chave do tenant (@@unique([tenantId, codigoInterno])).
 *  - codigoMunicipal: código LC 116/2003 (formato livre — ex '17.01', '01.05').
 *  - precoPadrao + aliquotaIss obrigatórios (regra de NFS-e).
 *  - Retenções (IR/INSS/PIS/COFINS/CSLL) são alíquotas opcionais.
 */

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d+)?$/.test(v), 'valor decimal inválido');

const decimalStringOptional = decimalString.optional().nullable();

export const ServicoCreateSchema = z.object({
  codigoInterno: z.string().min(1).max(60),
  descricao: z.string().min(1).max(500),
  codigoMunicipal: z.string().min(1).max(20),
  cnae: z.string().max(10).optional().nullable(),
  precoPadrao: decimalString,
  aliquotaIss: decimalString,
  retencaoIr: decimalStringOptional,
  retencaoInss: decimalStringOptional,
  retencaoPis: decimalStringOptional,
  retencaoCofins: decimalStringOptional,
  retencaoCsll: decimalStringOptional,
});
export type ServicoCreateInput = z.infer<typeof ServicoCreateSchema>;

export const ServicoUpdateSchema = ServicoCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});
export type ServicoUpdateInput = z.infer<typeof ServicoUpdateSchema>;

export const ServicoListQuerySchema = PaginationQuerySchema.extend({
  codigoMunicipal: z.string().optional(),
});
export type ServicoListQuery = z.infer<typeof ServicoListQuerySchema>;
