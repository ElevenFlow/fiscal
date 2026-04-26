import { z } from 'zod';

/**
 * Helpers e schemas Zod compartilhados entre os 6 cadastros (Phase 2 Plan 02-02).
 *
 * Convenções:
 *  - Todos os schemas que aceitam CPF/CNPJ aplicam `.transform(strip-mask)` para
 *    persistir somente dígitos. UI mascara via `<MaskedInput />` — o backend nunca
 *    deve confiar no formato visual.
 *  - Endereço sempre via `enderecoSchema` (objeto único persistido em coluna `Json`
 *    no Prisma — ver schema.prisma `Cliente.endereco`, `Fornecedor.endereco`, ...).
 *  - Paginação default offset (decisão CONTEXT.md). pageSize cap em 200 evita DoS
 *    (T-02-02-06).
 */

// ============================================================================
// Documentos / endereço / paginação
// ============================================================================

/** CNPJ aceita com ou sem máscara; persiste só dígitos. */
export const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 14, 'CNPJ deve ter 14 dígitos');

/** CPF aceita com ou sem máscara; persiste só dígitos. */
export const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11, 'CPF deve ter 11 dígitos');

/** CPF ou CNPJ — útil em Cliente PF/PJ unificado. */
export const cpfCnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11 || v.length === 14, 'CPF/CNPJ inválido');

/** UF brasileira em maiúsculas (ex: SP, RJ). */
export const ufSchema = z
  .string()
  .length(2)
  .transform((v) => v.toUpperCase());

/** CEP — 8 dígitos sem hífen. */
export const cepSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 8, 'CEP deve ter 8 dígitos');

/** Endereço estruturado — persistido em coluna Json. */
export const enderecoSchema = z.object({
  logradouro: z.string().min(1).max(200),
  numero: z.string().max(20).optional().nullable(),
  complemento: z.string().max(60).optional().nullable(),
  bairro: z.string().min(1).max(100),
  cep: cepSchema,
  cidade: z.string().min(1).max(100),
  uf: ufSchema,
});
export type Endereco = z.infer<typeof enderecoSchema>;

/**
 * Query base para listagens paginadas.
 * - page/pageSize: offset-based (decisão CONTEXT.md).
 * - search: full-text simples (ILIKE) — services interpretam.
 * - sort: 'campo:asc|desc' (services parseiam via parseSort).
 * - ativo: filtro opcional 'true'|'false'.
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
  sort: z.string().optional(),
  ativo: z.union([z.literal('true'), z.literal('false')]).optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Resultado padronizado de listagens paginadas. */
export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ============================================================================
// Validação CPF/CNPJ — algoritmo dígito verificador (Receita Federal)
// ============================================================================

/**
 * Valida CPF via algoritmo de dígito verificador (Receita Federal).
 * Rejeita CPFs com todos os dígitos iguais ('111.111.111-11') — caso conhecido
 * que passa no checksum mas é considerado inválido.
 */
export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calc = (slice: number, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice; i++) {
      const digit = cpf[i];
      if (digit === undefined) return -1;
      sum += Number.parseInt(digit, 10) * (factorStart - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d9 = cpf[9];
  const d10 = cpf[10];
  if (d9 === undefined || d10 === undefined) return false;
  return calc(9, 10) === Number.parseInt(d9, 10) && calc(10, 11) === Number.parseInt(d10, 10);
}

/** Valida CNPJ via dígito verificador (Receita Federal). */
export function isValidCnpj(raw: string): boolean {
  const cnpj = raw.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const factors1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const factors2 = [6, ...factors1];

  const calc = (factors: number[]): number => {
    let sum = 0;
    for (let i = 0; i < factors.length; i++) {
      const digit = cnpj[i];
      const factor = factors[i];
      if (digit === undefined || factor === undefined) return -1;
      sum += Number.parseInt(digit, 10) * factor;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d12 = cnpj[12];
  const d13 = cnpj[13];
  if (d12 === undefined || d13 === undefined) return false;
  return calc(factors1) === Number.parseInt(d12, 10) && calc(factors2) === Number.parseInt(d13, 10);
}

/**
 * Schema CPF/CNPJ com validação de dígito verificador.
 * Use este em criação de Cliente PF/PJ — `cpfCnpjSchema` (sem refine) é só para
 * casos onde a validação dígito-a-dígito já foi feita upstream.
 */
export const cpfCnpjValidatedSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(
    (v) => (v.length === 11 ? isValidCpf(v) : v.length === 14 ? isValidCnpj(v) : false),
    'CPF/CNPJ inválido (dígito verificador)',
  );

/** Schema CNPJ com validação dígito verificador — usar em Empresa/Contabilidade/Fornecedor. */
export const cnpjValidatedSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 14 && isValidCnpj(v), 'CNPJ inválido (dígito verificador)');
