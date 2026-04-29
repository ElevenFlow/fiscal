import { z } from 'zod';

export const DocumentoFiscalQuerySchema = z.object({
  tipo: z.enum(['todos', 'NFE_55', 'NFSE', 'DEVOLUCAO']).default('todos').optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().max(120).optional(),
  dataInicio: z.string().trim().optional(),
  dataFim: z.string().trim().optional(),
  valorMin: z.coerce.number().nonnegative().optional(),
  valorMax: z.coerce.number().nonnegative().optional(),
});

export type DocumentoFiscalQuery = z.infer<typeof DocumentoFiscalQuerySchema>;

export const DocumentoExportSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  formato: z.enum(['csv', 'zip']).default('csv'),
});

export type DocumentoExportInput = z.infer<typeof DocumentoExportSchema>;

export const AlertasQuerySchema = z.object({
  severidade: z.enum(['critico', 'atencao', 'info']).optional(),
  tipo: z.string().trim().optional(),
  status: z.enum(['aberto', 'resolvido', 'todos']).default('aberto').optional(),
});

export type AlertasQuery = z.infer<typeof AlertasQuerySchema>;
