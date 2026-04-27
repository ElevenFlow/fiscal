/**
 * auth.ts — helpers server-side de sessão (Plan 02.1-03).
 * Substitui clerk-shim.ts: lê claims do JWT no cookie nf_access.
 *
 * Server-only: não importar de client components (T-02.1-03-02).
 */
import 'server-only';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const ACCESS_COOKIE = 'nf_access';

export interface SessionUser {
  userId: string;
  contabilidadeId: string | null;
  role: 'platform_admin' | 'tenant_user';
}

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET;
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET não configurado em produção');
  }
  return new TextEncoder().encode(raw ?? 'dev-only-insecure-jwt-secret-nexofiscal-2026!!');
}

/**
 * Retorna sessão atual ou null se não autenticado.
 * Usar em Server Components, Route Handlers, Server Actions.
 */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      contabilidadeId: (payload.contabilidadeId as string | null) ?? null,
      role: (payload.role as 'platform_admin' | 'tenant_user') ?? 'tenant_user',
    };
  } catch {
    return null;
  }
}

/**
 * Retorna sessão ou redireciona /entrar.
 * Usar em layouts protegidos: `const session = await requireSession();`
 */
export async function requireSession(redirectTo = '/entrar'): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(redirectTo);
  return session;
}
