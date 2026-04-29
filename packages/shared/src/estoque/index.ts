import { z } from 'zod';

const decimalString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,4})?$/, 'Informe um numero decimal valido');

export const XmlCompraUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  xml: z.string().min(1),
});

export type XmlCompraUploadInput = z.infer<typeof XmlCompraUploadSchema>;

export const XmlItemDecisionSchema = z.discriminatedUnion('acao', [
  z.object({
    itemId: z.string().trim().min(1),
    acao: z.literal('vincular'),
    produtoId: z.string().uuid(),
  }),
  z.object({
    itemId: z.string().trim().min(1),
    acao: z.literal('criar'),
    codigo: z.string().trim().min(1).max(60),
    descricao: z.string().trim().min(2).max(255),
    ncm: z
      .string()
      .trim()
      .regex(/^\d{8}$/),
    unidade: z.string().trim().min(1).max(6),
    precoVenda: decimalString,
  }),
  z.object({
    itemId: z.string().trim().min(1),
    acao: z.literal('ignorar'),
  }),
]);

export const XmlImportConfirmSchema = z.object({
  decisions: z.array(XmlItemDecisionSchema).min(1),
});

export type XmlImportConfirmInput = z.infer<typeof XmlImportConfirmSchema>;

export const EstoqueMovimentacaoManualSchema = z.object({
  produtoId: z.string().uuid(),
  tipo: z.enum(['entrada', 'saida', 'ajuste']),
  quantidade: decimalString.refine((v) => Number(v) > 0, 'Quantidade deve ser maior que zero'),
  motivo: z.string().trim().min(3).max(180),
});

export type EstoqueMovimentacaoManualInput = z.infer<typeof EstoqueMovimentacaoManualSchema>;

export const EstoqueMovimentacaoQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  tipo: z.enum(['entrada', 'saida', 'ajuste', 'estorno']).optional(),
  origem: z.enum(['xml', 'nfe', 'manual']).optional(),
  dataInicio: z.string().trim().optional(),
  dataFim: z.string().trim().optional(),
});

export type EstoqueMovimentacaoQuery = z.infer<typeof EstoqueMovimentacaoQuerySchema>;
