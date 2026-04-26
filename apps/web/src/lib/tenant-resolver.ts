/**
 * tenant-resolver.ts — server-only (Plan 02-09 religou).
 *
 * Lê a sessão Clerk e resolve o escopo do tenant para passar adiante via
 * `x-tenant-id`/`x-contabilidade-id` quando proxia para apps/api.
 *
 * Convenções (Plan 01-07):
 *  - `userId`         = Clerk user id (`user_xxx`); apps/api converte para DB id.
 *  - `contabilidadeId`= Clerk org id (`org_xxx`); apps/api converte para DB id.
 *  - `empresaId`      = `publicMetadata.activeEmpresaId` (selecionado em UI).
 *  - `role`           = `publicMetadata.role === 'platform_admin' ? 'platform_admin' : 'tenant_user'`.
 */

import { auth } from '@clerk/nextjs/server';

export interface ResolvedTenant {
  userId: string | null;
  contabilidadeId: string | null;
  empresaId: string | null;
  role: 'platform_admin' | 'tenant_user' | 'anonymous';
}

export async function resolveTenant(): Promise<ResolvedTenant> {
  const session = await auth();
  if (!session.userId) {
    return { userId: null, contabilidadeId: null, empresaId: null, role: 'anonymous' };
  }
  const claims = (session.sessionClaims ?? {}) as Record<string, unknown>;
  const publicMetadata = (claims.public_metadata ?? claims.publicMetadata ?? {}) as {
    activeEmpresaId?: string;
    role?: string;
  };
  return {
    userId: session.userId,
    contabilidadeId: session.orgId ?? null,
    empresaId: publicMetadata.activeEmpresaId ?? null,
    role: publicMetadata.role === 'platform_admin' ? 'platform_admin' : 'tenant_user',
  };
}
