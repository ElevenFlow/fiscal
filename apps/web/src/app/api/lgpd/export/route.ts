import { NextResponse } from 'next/server';
import { fetchApi } from '@/lib/api-client';

/**
 * Next.js Route Handler — proxy autenticado para apps/api GET /api/lgpd/export.
 *
 * Por que existe (BLOCKER #2 Option A):
 *  - Client components NÃO podem usar `api-client.ts` (server-only: futuro @clerk/nextjs/server)
 *  - Bearer token não flui de client para cross-origin sem CORS + cookie SameSite
 *  - Route handler executa server-side → pode chamar auth() → getToken() → Bearer
 *  - Cliente vê resposta same-origin, cookies Clerk fluem naturalmente
 *
 * Resposta: Content-Disposition: attachment para forçar download do JSON.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await fetchApi<unknown>('/api/lgpd/export');
    const json = JSON.stringify(data, null, 2);
    const filename = `nexofiscal-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    const status = /401|403/.test(message) ? 401 : 500;
    return NextResponse.json(
      { error: 'lgpd_export_failed', detail: message },
      { status },
    );
  }
}
