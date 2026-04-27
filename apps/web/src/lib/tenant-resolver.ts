/**
 * tenant-resolver.ts — Plan 02.1-03 (auth in-house).
 * Lê sessão do JWT cookie em vez da sessão Clerk.
 *
 * empresaId virá de estado UI ou cookie separado na Phase 7.1.
 */
import { getSession } from './auth';

export interface ResolvedTenant {
  userId: string | null;
  contabilidadeId: string | null;
  empresaId: string | null;
  role: 'platform_admin' | 'tenant_user' | 'anonymous';
}

export async function resolveTenant(): Promise<ResolvedTenant> {
  const session = await getSession();
  if (!session) {
    return { userId: null, contabilidadeId: null, empresaId: null, role: 'anonymous' };
  }
  return {
    userId: session.userId,
    contabilidadeId: session.contabilidadeId,
    empresaId: null, // empresaId virá de estado UI ou cookie separado (Phase 7.1)
    role: session.role,
  };
}
