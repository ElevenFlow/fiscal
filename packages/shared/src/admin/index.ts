import { z } from 'zod';

export const ConfiguracaoEmpresaSchema = z.object({
  razaoSocial: z.string().trim().min(2).optional(),
  nomeFantasia: z.string().trim().optional().nullable(),
  ie: z.string().trim().optional().nullable(),
  im: z.string().trim().optional().nullable(),
  cnae: z.string().trim().optional().nullable(),
  regimeTributario: z.string().trim().min(2).optional(),
  endereco: z.record(z.unknown()).optional(),
  contatos: z.record(z.unknown()).optional(),
});

export type ConfiguracaoEmpresaInput = z.infer<typeof ConfiguracaoEmpresaSchema>;

export const ConfiguracaoTemplateEmailSchema = z.object({
  assunto: z.string().trim().min(3),
  remetente: z.string().trim().email(),
  ccPadrao: z.string().trim().optional().nullable(),
  corpo: z.string().trim().min(10),
});

export type ConfiguracaoTemplateEmailInput = z.infer<typeof ConfiguracaoTemplateEmailSchema>;

export const ConfiguracaoPreferenciasSchema = z.object({
  formatoData: z.enum(['BR', 'ISO']).default('BR'),
  tema: z.enum(['claro', 'escuro', 'sistema']).default('claro'),
  notificacoes: z
    .object({
      email: z.boolean().default(true),
      push: z.boolean().default(false),
      sino: z.boolean().default(true),
    })
    .default({ email: true, push: false, sino: true }),
});

export type ConfiguracaoPreferenciasInput = z.infer<typeof ConfiguracaoPreferenciasSchema>;

export const UsuariosQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ativo', 'convidado', 'bloqueado']).optional(),
  role: z.string().trim().optional(),
});

export type UsuariosQuery = z.infer<typeof UsuariosQuerySchema>;

export const UsuarioCreateSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().email(),
  role: z.string().trim().min(2),
  scopeType: z.enum(['platform', 'contabilidade', 'empresa']).default('empresa'),
  scopeId: z.string().uuid().optional().nullable(),
  enviarConvite: z.boolean().default(true),
});

export type UsuarioCreateInput = z.infer<typeof UsuarioCreateSchema>;

export const UsuarioUpdateSchema = z.object({
  role: z.string().trim().min(2).optional(),
  scopeType: z.enum(['platform', 'contabilidade', 'empresa']).optional(),
  scopeId: z.string().uuid().optional().nullable(),
});

export type UsuarioUpdateInput = z.infer<typeof UsuarioUpdateSchema>;

export const UsuarioAcaoSchema = z.object({
  acao: z.enum(['bloquear', 'desbloquear', 'reenviar_convite', 'redefinir_senha']),
});

export type UsuarioAcaoInput = z.infer<typeof UsuarioAcaoSchema>;

export const AuditoriaQuerySchema = z.object({
  search: z.string().trim().optional(),
  usuario: z.string().trim().optional(),
  action: z.string().trim().optional(),
  resourceType: z.string().trim().optional(),
  result: z.enum(['success', 'failure']).optional(),
  dataInicio: z.string().trim().optional(),
  dataFim: z.string().trim().optional(),
});

export type AuditoriaQuery = z.infer<typeof AuditoriaQuerySchema>;
