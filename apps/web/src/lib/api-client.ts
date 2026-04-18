/**
 * apps/web/src/lib/api-client.ts — placeholder no MODO PROTÓTIPO.
 *
 * O backend (apps/api) está desacoplado e o frontend roda 100% com mocks em
 * memória / localStorage. Esta camada existe apenas para manter compatibilidade
 * de importação de arquivos legados que ainda referenciam `fetchApi` — em breve
 * esses também serão migrados.
 *
 * Para restaurar a integração real com Clerk + apps/api, consulte o git log do
 * Plan 01-07 (`feat(01-07): Clerk integration`).
 */

export interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  body?: string;
  tenantId?: string | null;
}

/**
 * Stub de fetchApi — sempre falha para sinalizar claramente que chamadas reais
 * à API não existem no modo protótipo. Consumidores devem migrar para mocks
 * locais.
 */
export async function fetchApi<T = unknown>(
  _path: string,
  _options: FetchApiOptions = {},
): Promise<T> {
  throw new Error('fetchApi indisponível em MODO PROTÓTIPO — use os mocks em src/lib/mock-data.ts');
}
