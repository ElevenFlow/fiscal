/**
 * apps/web/src/lib/api-client.ts — Plan 02.1-03 (auth in-house).
 *
 * fetchApi: cliente server-side autenticado. Injeta o cookie nf_access como
 * Authorization: Bearer header para apps/api. Substitui o mecanismo Clerk Bearer.
 *
 * Server-only: usa cookies() de next/headers — não importar de client components.
 * Em dev com ALLOW_HEADER_AUTH=true no apps/api, aceita headers x-user-id/x-role
 * para integration tests sem JWT (compat Plan 02-05).
 *
 * T-02.1-03-07: nf_access é HttpOnly — browser não acessa; fetchApi lê
 * via cookies() server-side apenas; token não exposto a client.
 */
import { cookies } from 'next/headers';

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

  // Lê o access token do cookie server-side (substitui Clerk auth().getToken())
  const jar = await cookies();
  const accessToken = jar.get('nf_access')?.value ?? null;

  const finalHeaders: Record<string, string> = { ...((headers as Record<string, string>) ?? {}) };
  if (accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;
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
