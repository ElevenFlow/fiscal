import { z } from 'zod';
import { PaginationQuerySchema, cpfCnpjValidatedSchema, enderecoSchema } from './common';

/**
 * Schemas Zod — Cliente PF/PJ (Phase 2 Plan 02-02).
 * Espelha apps/api/prisma/schema.prisma model Cliente.
 *
 * Notas:
 *  - tipoPessoa: 'fisica' | 'juridica' (mesmas strings persistidas no DB).
 *  - cpfCnpj: validado por dígito verificador (RFB) e normalizado para dígitos.
 *  - contribuinteIcms: enum 'sim'|'nao'|'isento' alinhado com mock UI.
 */

export const tipoPessoaEnum = z.enum(['fisica', 'juridica']);
export type TipoPessoa = z.infer<typeof tipoPessoaEnum>;

export const contribuinteIcmsEnum = z.enum(['sim', 'nao', 'isento']);
export type ContribuinteIcms = z.infer<typeof contribuinteIcmsEnum>;

export const ClienteCreateSchema = z.object({
  tipoPessoa: tipoPessoaEnum,
  cpfCnpj: cpfCnpjValidatedSchema,
  nome: z.string().min(2).max(200),
  nomeFantasia: z.string().max(200).optional().nullable(),
  inscricaoEst: z.string().max(20).optional().nullable(),
  inscricaoMun: z.string().max(20).optional().nullable(),
  contribuinteIcms: contribuinteIcmsEnum.default('nao'),
  endereco: enderecoSchema,
  email: z.string().email().optional().nullable(),
  telefone: z.string().max(30).optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),
});
export type ClienteCreateInput = z.infer<typeof ClienteCreateSchema>;

export const ClienteUpdateSchema = ClienteCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});
export type ClienteUpdateInput = z.infer<typeof ClienteUpdateSchema>;

export const ClienteListQuerySchema = PaginationQuerySchema.extend({
  tipoPessoa: tipoPessoaEnum.optional(),
  uf: z.string().length(2).optional(),
});
export type ClienteListQuery = z.infer<typeof ClienteListQuerySchema>;
