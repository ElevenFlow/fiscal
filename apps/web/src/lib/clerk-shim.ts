/**
 * clerk-shim.ts — Plan 02-09.
 *
 * Abstrai "qual auth usar?":
 *  - DEFAULT (Clerk Organizations religado neste plan): consome `auth()` do
 *    `@clerk/nextjs/server` — Bearer JWT validado pelo middleware Clerk.
 *  - FALLBACK opt-in (`USE_PROTOTYPE_AUTH=true`): cookie HMAC do modo protótipo
 *    single-user. Mantido para emergência caso Clerk fique indisponível.
 *
 * Os arquivos de aplicação (layouts protegidos, route handlers) chamam
 * `getCurrentUser()` em vez de `auth()` direto — assim trocar de modo é flag-flip
 * sem refactor cascata.
 *
 * Ver `docs/CLERK_SETUP.md` seção 10 para o procedimento de rollback completo.
 */

import { auth as clerkAuth } from '@clerk/nextjs/server';

export interface CurrentUser {
  userId: string | null;
  contabilidadeId: string | null;
  email: string | null;
  source: 'clerk' | 'prototype-cookie';
}

export async function getCurrentUser(): Promise<CurrentUser> {
  if (process.env.USE_PROTOTYPE_AUTH === 'true') {
    // Importação dinâmica para evitar carregar dependências do shim quando Clerk é o default
    const { cookies } = await import('next/headers');
    const { SESSION_COOKIE_NAME, getAuthSecret, verifySession } = await import('./session');
    const c = await cookies();
    const token = c.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return { userId: null, contabilidadeId: null, email: null, source: 'prototype-cookie' };
    }
    const session = await verifySession(token, getAuthSecret());
    return {
      userId: session?.email ?? null,
      contabilidadeId: null,
      email: session?.email ?? null,
      source: 'prototype-cookie',
    };
  }

  const session = await clerkAuth();
  return {
    userId: session.userId,
    contabilidadeId: session.orgId ?? null,
    email: null, // Clerk session() não inclui email; useUser() no client fornece.
    source: 'clerk',
  };
}
