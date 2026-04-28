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

export const NotaFiscalModeloSchema = z.enum(['NFE_55']);
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
