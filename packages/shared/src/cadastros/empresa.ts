import { z } from 'zod';
import { PaginationQuerySchema, cnpjValidatedSchema, enderecoSchema } from './common';

/**
 * Schemas Zod — Empresa (tenant) (Phase 2 Plan 02-02).
 * Espelha apps/api/prisma/schema.prisma model Empresa (estendido em Plan 02-01).
 *
 * Notas:
 *  - cnpj: validado por dígito verificador.
 *  - regimeTributario: enum alinhado com seed.ts ('simples_nacional'|'lucro_presumido'|...).
 *  - endereco/contatos: opcionais no Prisma — Empresa pode ser criada incompleta
 *    e completada depois (workflow de onboarding contábil).
 *  - tenantId é managed by app (sempre = id da empresa) — NÃO aceitar do client.
 */

export const regimeTributarioEnum = z.enum([
  'simples_nacional',
  'lucro_presumido',
  'lucro_real',
  'mei',
]);
export type RegimeTributario = z.infer<typeof regimeTributarioEnum>;

export const contatosEmpresaSchema = z.object({
  email: z.string().email().optional().nullable(),
  telefone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  responsavel: z.string().max(120).optional().nullable(),
});
export type ContatosEmpresa = z.infer<typeof contatosEmpresaSchema>;

export const EmpresaCreateSchema = z.object({
  razaoSocial: z.string().min(2).max(200),
  nomeFantasia: z.string().max(200).optional().nullable(),
  cnpj: cnpjValidatedSchema,
  ie: z.string().max(20).optional().nullable(),
  im: z.string().max(20).optional().nullable(),
  cnae: z.string().max(10).optional().nullable(),
  regimeTributario: regimeTributarioEnum,
  endereco: enderecoSchema.optional().nullable(),
  contatos: contatosEmpresaSchema.optional().nullable(),
  contabilidadeId: z.string().uuid().optional().nullable(),
});
export type EmpresaCreateInput = z.infer<typeof EmpresaCreateSchema>;

export const EmpresaUpdateSchema = EmpresaCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});
export type EmpresaUpdateInput = z.infer<typeof EmpresaUpdateSchema>;

export const EmpresaListQuerySchema = PaginationQuerySchema.extend({
  regimeTributario: regimeTributarioEnum.optional(),
  uf: z.string().length(2).optional(),
});
export type EmpresaListQuery = z.infer<typeof EmpresaListQuerySchema>;
