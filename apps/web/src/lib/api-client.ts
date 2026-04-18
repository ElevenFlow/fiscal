/**
 * apps/web/src/lib/api-client.ts — server-side fetch helper para apps/api.
 *
 * PLACEHOLDER (Plan 01-09 wave 3): Plan 01-07 (Clerk Auth) será o owner real deste arquivo
 * e plugará `auth()` + `getToken()` do @clerk/nextjs/server para anexar Bearer token.
 *
 * Enquanto Plan 07 não entra, esta implementação:
 *  - Usa header-based auth do TenantContextMiddleware (Plan 01-05 — ALLOW_HEADER_AUTH=true em dev)
 *  - Anexa x-user-id / x-role a partir de env vars DEV_LGPD_USER_ID / DEV_LGPD_ROLE
 *    (ou default 'tenant_user' sem userId — resultará em 401 esperado)
 *  - TODO (Plan 07): substituir por Bearer JWT via auth().getToken()
 *
 * Este módulo é SERVER-ONLY: nunca importar de client components (BLOCKER #2).
 * Client components devem chamar Next.js Route Handlers same-origin que por sua vez
 * chamam fetchApi() server-side.
 */

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  body?: string;
}

/**
 * fetchApi — faz request ao apps/api com auth server-side.
 *
 * Throws Error se response não-ok. Inclui status code no message para que
 * route handlers possam distinguir 401/403 de 5xx.
 */
export async function fetchApi<T = unknown>(
  path: string,
  options: FetchApiOptions = {},
): Promise<T> {
  // TODO (Plan 01-07 Clerk): substituir por:
  //   const { getToken } = await auth();
  //   const token = await getToken();
  //   headers['Authorization'] = `Bearer ${token}`;
  //
  // PLACEHOLDER: header-based auth de Plan 01-05 (ALLOW_HEADER_AUTH=true em dev/test).
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const devUserId = process.env.DEV_LGPD_USER_ID;
  const devRole = process.env.DEV_LGPD_ROLE ?? 'tenant_user';
  if (devUserId) {
    headers['x-user-id'] = devUserId;
    headers['x-role'] = devRole;
  }

  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fetchApi ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }

  // Algumas rotas podem retornar vazio (204); tratar como unknown.
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}
