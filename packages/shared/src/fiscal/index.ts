import { z } from 'zod';

export const FiscalAmbienteSchema = z.enum(['HOMOLOGACAO', 'PRODUCAO']);
export type FiscalAmbiente = z.infer<typeof FiscalAmbienteSchema>;

export const NotaFiscalStatusSchema = z.enum([
  'DRAFT',
  'SIGNING',
  'TRANSMITTING',
  'PENDING_RESPONSE',
  'AUTHORIZED',
  'REJECTED',
  'CANCELLED',
]);
export type NotaFiscalStatus = z.infer<typeof NotaFiscalStatusSchema>;

export const NotaFiscalModeloSchema = z.enum(['NFE_55', 'NFSE', 'DEVOLUCAO']);
export type NotaFiscalModelo = z.infer<typeof NotaFiscalModeloSchema>;

export const FiscalGatewayResultSchema = z.object({
  status: NotaFiscalStatusSchema,
  chaveAcesso: z.string().length(44).optional(),
  recibo: z.string().optional(),
  protocolo: z.string().optional(),
  codigo: z.string().optional(),
  mensagem: z.string().optional(),
  xmlAutorizado: z.string().optional(),
});
export type FiscalGatewayResult = z.infer<typeof FiscalGatewayResultSchema>;

export const NfeDraftCreateSchema = z.object({
  empresaId: z.string().uuid(),
  serieFiscalId: z.string().uuid().optional(),
  ambiente: FiscalAmbienteSchema,
  serie: z.coerce.number().int().min(0).max(999),
  idempotencyKey: z.string().min(8).max(120),
  payload: z.record(z.unknown()),
});
export type NfeDraftCreateInput = z.infer<typeof NfeDraftCreateSchema>;

export const NfeCancelSchema = z.object({
  justificativa: z.string().trim().min(15).max(255),
});
export type NfeCancelInput = z.infer<typeof NfeCancelSchema>;

export const NfseDraftCreateSchema = z.object({
  empresaId: z.string().uuid(),
  serieFiscalId: z.string().uuid().optional(),
  ambiente: FiscalAmbienteSchema,
  serie: z.coerce.number().int().min(0).max(999),
  idempotencyKey: z.string().min(8).max(120),
  payload: z.object({
    municipioPrestacao: z.string().trim().min(2).max(120).default('Santa Catarina'),
    ufPrestacao: z.string().trim().length(2).default('SC'),
    tomador: z.record(z.unknown()),
    servico: z.record(z.unknown()),
    tributacao: z.record(z.unknown()).optional(),
    valores: z.record(z.unknown()),
    observacoes: z.string().trim().max(2000).optional(),
    integracaoMunicipal: z.literal(false).default(false),
  }),
});
export type NfseDraftCreateInput = z.infer<typeof NfseDraftCreateSchema>;

export const DevolucaoDraftCreateSchema = z.object({
  empresaId: z.string().uuid(),
  serieFiscalId: z.string().uuid().optional(),
  ambiente: FiscalAmbienteSchema,
  serie: z.coerce.number().int().min(0).max(999),
  idempotencyKey: z.string().min(8).max(120),
  payload: z.object({
    notaOrigemId: z.string().uuid().optional(),
    chaveOrigem: z.string().trim().min(44).max(60),
    numeroOrigem: z.string().trim().min(1).max(20),
    fornecedor: z.record(z.unknown()),
    itens: z.array(
      z.object({
        sku: z.string().trim().min(1).max(80),
        descricao: z.string().trim().min(1).max(500),
        quantidade: z.coerce.number().positive(),
        valorUnitario: z.coerce.number().nonnegative(),
        cfopOrigem: z.string().trim().length(4).optional(),
        cfopDevolucao: z.string().trim().length(4),
      }),
    ).min(1),
    motivo: z.string().trim().min(15).max(500),
    observacoes: z.string().trim().max(2000).optional(),
  }),
});
export type DevolucaoDraftCreateInput = z.infer<typeof DevolucaoDraftCreateSchema>;
