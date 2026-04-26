import { z } from 'zod';
import { PaginationQuerySchema, cnpjValidatedSchema, enderecoSchema } from './common.js';

/**
 * Schemas Zod — Contabilidade (Phase 2 Plan 02-02).
 * Espelha apps/api/prisma/schema.prisma model Contabilidade.
 *
 * Notas:
 *  - cnpj é UNIQUE global (não tenant-scoped — Contabilidade NÃO tem tenantId).
 *  - Apenas admin (platform_admin) cria/edita/exclui — RBAC restrito no controller.
 *  - clerkOrgId é gerenciado pelo webhook svix (Plan 02-09); NÃO aceitar via API.
 */

export const contatosContabilidadeSchema = z.object({
  email: z.string().email().optional().nullable(),
  telefone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  responsavel: z.string().max(120).optional().nullable(),
});
export type ContatosContabilidade = z.infer<typeof contatosContabilidadeSchema>;

export const ContabilidadeCreateSchema = z.object({
  nome: z.string().min(2).max(200),
  cnpj: cnpjValidatedSchema,
  endereco: enderecoSchema.optional().nullable(),
  contatos: contatosContabilidadeSchema.optional().nullable(),
});
export type ContabilidadeCreateInput = z.infer<typeof ContabilidadeCreateSchema>;

export const ContabilidadeUpdateSchema = ContabilidadeCreateSchema.partial();
export type ContabilidadeUpdateInput = z.infer<typeof ContabilidadeUpdateSchema>;

export const ContabilidadeListQuerySchema = PaginationQuerySchema;
export type ContabilidadeListQuery = z.infer<typeof ContabilidadeListQuerySchema>;
