import { z } from 'zod';
import { PaginationQuerySchema, cpfCnpjValidatedSchema, enderecoSchema } from './common';

/**
 * Schemas Zod — Fornecedor (Phase 2 Plan 02-02).
 * Espelha apps/api/prisma/schema.prisma model Fornecedor.
 *
 * Diferenças vs Cliente:
 *  - Sempre PJ (cpfCnpj aceita 11 ou 14, mas convencionalmente 14).
 *  - Tem `condicoesPadrao` Json para condições comerciais (prazo pgto, desconto).
 *  - `contatoComercial` é nome de contato, não email/telefone (esses ficam em fields próprios).
 */

export const FornecedorCreateSchema = z.object({
  cpfCnpj: cpfCnpjValidatedSchema,
  razaoSocial: z.string().min(2).max(200),
  nomeFantasia: z.string().max(200).optional().nullable(),
  inscricaoEst: z.string().max(20).optional().nullable(),
  endereco: enderecoSchema,
  email: z.string().email().optional().nullable(),
  telefone: z.string().max(30).optional().nullable(),
  contatoComercial: z.string().max(120).optional().nullable(),
  condicoesPadrao: z.record(z.unknown()).optional().nullable(),
});
export type FornecedorCreateInput = z.infer<typeof FornecedorCreateSchema>;

export const FornecedorUpdateSchema = FornecedorCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});
export type FornecedorUpdateInput = z.infer<typeof FornecedorUpdateSchema>;

export const FornecedorListQuerySchema = PaginationQuerySchema.extend({
  uf: z.string().length(2).optional(),
});
export type FornecedorListQuery = z.infer<typeof FornecedorListQuerySchema>;
