import { z } from 'zod';
import { PaginationQuerySchema } from './common';

/**
 * Schemas Zod — Produto (Phase 2 Plan 02-02).
 * Espelha apps/api/prisma/schema.prisma model Produto.
 *
 * Notas:
 *  - codigo é SKU interno; @@unique([tenantId, codigo]) — duplicidade por tenant.
 *  - ncm 8 dígitos, cest 7 dígitos, cfopPadrao 4 dígitos.
 *  - Decimals serializados como string (Prisma Decimal → string em JSON).
 *  - origemMercadoria 0..8 conforme tabela ICMS RFB.
 *
 * Validações estruturais (regex) aqui; validação semântica de NCM/CEST/CFOP
 * (existe no catálogo lookup?) fica no service ou em endpoints de validação.
 */

const onlyDigits = (re: RegExp, msg: string) =>
  z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => re.test(v), msg);

const optionalDigits = (re: RegExp, msg: string) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v == null || v === '' ? null : v.replace(/\D/g, '')))
    .refine((v) => v == null || re.test(v), msg);

/** Decimal positivo serializado como string (compatível com Prisma Decimal). */
const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d+)?$/.test(v), 'valor decimal inválido');

const decimalStringOptional = decimalString.optional().nullable();

export const ProdutoCreateSchema = z.object({
  codigo: z.string().min(1).max(60),
  descricao: z.string().min(1).max(500),
  ncm: onlyDigits(/^\d{8}$/, 'NCM deve ter 8 dígitos'),
  cest: optionalDigits(/^\d{7}$/, 'CEST deve ter 7 dígitos'),
  cfopPadrao: optionalDigits(/^\d{4}$/, 'CFOP deve ter 4 dígitos'),
  cstIcms: z.string().max(3).optional().nullable(),
  csosn: z.string().max(3).optional().nullable(),
  origemMercadoria: z.coerce.number().int().min(0).max(8).default(0),
  unidade: z.string().min(1).max(6),
  peso: decimalStringOptional,
  categoria: z.string().max(100).optional().nullable(),
  precoCusto: decimalStringOptional,
  margem: decimalStringOptional,
  precoVenda: decimalString,
  aliquotaIcms: decimalStringOptional,
  aliquotaIpi: decimalStringOptional,
  aliquotaPis: decimalStringOptional,
  aliquotaCofins: decimalStringOptional,
  estoqueInicial: decimalStringOptional,
  estoqueMinimo: decimalStringOptional,
  estoqueMaximo: decimalStringOptional,
});
export type ProdutoCreateInput = z.infer<typeof ProdutoCreateSchema>;

export const ProdutoUpdateSchema = ProdutoCreateSchema.partial().extend({
  ativo: z.boolean().optional(),
});
export type ProdutoUpdateInput = z.infer<typeof ProdutoUpdateSchema>;

export const ProdutoListQuerySchema = PaginationQuerySchema.extend({
  ncm: z
    .string()
    .regex(/^\d{8}$/)
    .optional(),
  categoria: z.string().optional(),
});
export type ProdutoListQuery = z.infer<typeof ProdutoListQuerySchema>;
