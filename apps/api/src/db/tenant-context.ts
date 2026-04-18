import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant propagado por AsyncLocalStorage.
 * Setado por `withTenantContext` antes de qualquer query.
 *
 * Ref: ARCHITECTURE.md — "Contexto por request".
 */
export interface TenantScope {
  /** UUID da empresa/tenant atual, ou null para operações platform. */
  tenantId: string | null;
  /** UUID da contabilidade (ator), se ação vem de um usuário contábil. */
  contabilidadeId: string | null;
  /** UUID do user logado. */
  userId: string | null;
  /** Role efetivo para a transação. 'platform_admin' bypassa RLS. */
  role: 'platform_admin' | 'tenant_user' | 'anonymous';
}

export const tenantStore = new AsyncLocalStorage<TenantScope>();

/**
 * Retorna o TenantScope corrente (ou null se não está em withTenantContext).
 */
export function getCurrentTenant(): TenantScope | null {
  return tenantStore.getStore() ?? null;
}

/**
 * Lança erro se chamado fora de withTenantContext.
 * Use em código que NÃO pode rodar sem contexto (ex: queries de domínio).
 */
export function requireTenant(): TenantScope {
  const scope = tenantStore.getStore();
  if (!scope) {
    throw new Error('requireTenant() called outside withTenantContext');
  }
  return scope;
}
