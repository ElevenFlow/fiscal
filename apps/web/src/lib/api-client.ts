/**
 * apps/web/src/lib/api-client.ts — server-side fetch helper para apps/api.
 *
 * Owner: Plan 01-07 (Clerk Auth). Este é o arquivo real pós-Clerk.
 *
 * Fluxo de auth:
 *  - Chamado server-side (React Server Component, Route Handler, Server Action).
 *  - `auth().getToken()` retorna o JWT da sessão Clerk atual (com `org_id` +
 *    `public_metadata` populados no claim customizado).
 *  - Token vai no header `Authorization: Bearer` — o ClerkGuard (apps/api)
 *    valida via `verifyToken` com `CLERK_SECRET_KEY`.
 *
 * Fallback dev (ALLOW_HEADER_AUTH=true + DEV_LGPD_USER_ID setado):
 *  - Mantém compatibilidade com Plan 01-05 para smoke tests sem Clerk provisionado.
 *  - Só ativa se NÃO houver token Clerk E a env dev estiver presente.
 *
 * SERVER-ONLY (BLOCKER #2 — Plan 09). Nunca importar em client components;
 * client deve chamar Next.js Route Handlers same-origin que por sua vez chamam fetchApi.
 */

import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  body?: string;
  /** Empresa ativa (UUID). Se presente, envia `x-tenant-id` para o middleware Nest. */
  tenantId?: string | null;
}

/**
 * fetchApi — faz request ao apps/api com Bearer JWT Clerk.
 *
 * Lança `Error` se response não-ok, incluindo status no message para que
 * route handlers distingam 401/403 (reauth) de 5xx (erro infra).
 */
export async function fetchApi<T = unknown>(
  path: string,
  options: FetchApiOptions = {},
): Promise<T> {
  const { tenantId, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  // 1) Tenta obter token Clerk (server-side). Se não houver sessão, `getToken`
  //    retorna null — caímos para o fallback dev ou erro 401 upstream.
  let clerkToken: string | null = null;
  try {
    const { getToken } = await auth();
    clerkToken = await getToken();
  } catch {
    // `auth()` lança se chamada fora do request scope (ex: seed). Fallback abaixo.
    clerkToken = null;
  }

  if (clerkToken) {
    headers.Authorization = `Bearer ${clerkToken}`;
  } else if (
    process.env.ALLOW_HEADER_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_LGPD_USER_ID
  ) {
    // Fallback dev para LGPD/test flows sem Clerk provisionado (Plan 05).
    headers['x-user-id'] = process.env.DEV_LGPD_USER_ID;
    headers['x-role'] = process.env.DEV_LGPD_ROLE ?? 'tenant_user';
  }

  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...fetchOptions, headers, cache: 'no-store' });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fetchApi ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}
