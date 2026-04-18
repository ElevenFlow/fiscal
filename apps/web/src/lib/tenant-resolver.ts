import { auth } from '@clerk/nextjs/server';

/**
 * Resolvedor de tenant server-side a partir da sessão Clerk (Plan 07).
 *
 * Mapeamento (conforme STACK.md — "Auth & Multi-Tenant"):
 *  - `userId`          → Clerk user id (subject do JWT)
 *  - `contabilidadeId` → Clerk `orgId` (Organization = Contabilidade no Nexo)
 *  - `empresaId`       → `publicMetadata.activeEmpresaId` do user
 *                        (setado via EmpresaSwitcher numa API mutation — Phase 2)
 *  - `role`            → 'platform_admin' se `publicMetadata.role === 'platform_admin'`,
 *                        senão 'tenant_user'.
 *
 * SERVER-ONLY. Não importar de client components.
 */
export interface ResolvedTenant {
  userId: string;
  contabilidadeId: string | null;
  empresaId: string | null;
  role: 'platform_admin' | 'tenant_user';
}

export async function resolveTenant(): Promise<ResolvedTenant | null> {
  const { userId, orgId, sessionClaims } = await auth();
  if (!userId) return null;

  const publicMeta =
    (sessionClaims as { public_metadata?: Record<string, unknown> } | null)?.public_metadata ?? {};
  const role: ResolvedTenant['role'] =
    publicMeta.role === 'platform_admin' ? 'platform_admin' : 'tenant_user';
  const empresaId =
    typeof publicMeta.activeEmpresaId === 'string' ? publicMeta.activeEmpresaId : null;

  return {
    userId,
    contabilidadeId: orgId ?? null,
    empresaId,
    role,
  };
}
