/**
 * apps/web/src/lib/api-client.ts — Plan 02-09 (religação Clerk).
 *
 * fetchApi: cliente server-side autenticado. Injeta Bearer JWT via
 * `auth().getToken()` do Clerk. Suporta:
 *  - Query/mutation tipados via genérico `T`.
 *  - Body string (JSON pré-serializado) ou FormData.
 *  - `tenantId` opcional → header `x-tenant-id` (empresa ativa).
 *  - Cache off por padrão (`no-store`) — dados pessoais nunca cacheiam.
 *
 * Modos de auth:
 *  - DEFAULT: Clerk session via `auth().getToken()` → `Authorization: Bearer ...`
 *  - FALLBACK opt-in: `USE_PROTOTYPE_AUTH=true` ignora Clerk; downstream
 *    consome cookie HMAC via clerk-shim.ts (apenas getCurrentUser, não fetchApi).
 *  - DEV: `ALLOW_HEADER_AUTH=true` no apps/api permite x-user-id/x-role headers
 *    sem JWT (útil para smoke tests sem Clerk provisionado).
 *
 * Ver Plan 02-09 SUMMARY para detalhes de Phase 2 plug-in (multipart, etc.).
 */

import { auth } from '@clerk/nextjs/server';

export interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  body?: string | FormData;
  tenantId?: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public bodyText: string,
  ) {
    super(`API ${status}: ${bodyText.slice(0, 200)}`);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T = unknown>(
  path: string,
  options: FetchApiOptions = {},
): Promise<T> {
  const { tenantId, body, headers, ...rest } = options;

  let token: string | null = null;
  if (process.env.USE_PROTOTYPE_AUTH !== 'true') {
    try {
      const session = await auth();
      token = await session.getToken();
    } catch {
      // Sessão Clerk indisponível (ex: em rota pública chamando API). Segue sem token;
      // o ClerkGuard rejeitará 401 — esperado para rota protegida.
    }
  }

  const finalHeaders: Record<string, string> = { ...((headers as Record<string, string>) ?? {}) };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (tenantId) finalHeaders['x-tenant-id'] = tenantId;
  if (typeof body === 'string' && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const res = await fetch(`${apiUrl}${path}`, {
    ...rest,
    headers: finalHeaders,
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
