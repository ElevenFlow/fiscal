import { z } from 'zod';

/**
 * Tipos de escopo para RBAC hierárquico (Admin > Contabilidade > Empresa).
 * Usados por auth middleware, RLS context e audit log.
 */
export const ScopeTypeSchema = z.enum(['platform', 'contabilidade', 'empresa']);
export type ScopeType = z.infer<typeof ScopeTypeSchema>;

export const RoleSchema = z.enum([
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
]);
export type Role = z.infer<typeof RoleSchema>;

/**
 * Tenant context carregado em cada request após auth.
 * Usado pelo middleware que seta `SET LOCAL app.current_tenant` no Postgres.
 */
export const TenantContextSchema = z.object({
  userId: z.string().uuid(),
  contabilidadeId: z.string().uuid().nullable(),
  empresaId: z.string().uuid().nullable(),
  role: RoleSchema,
  scopeType: ScopeTypeSchema,
});
export type TenantContext = z.infer<typeof TenantContextSchema>;
