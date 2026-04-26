import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

/**
 * Route Handler proxy: GET /api/integrations/cnpj/:cnpj (Plan 02-03 Task 3).
 *
 * Proxia para apps/api `/api/integrations/cnpj/:cnpj` injetando Bearer JWT
 * via fetchApi (Plan 02-09 — Clerk reativado). Mantém o JWT server-side, jamais
 * expõe ao browser.
 *
 * O backend (BrasilApiService) faz cache (cnpj_cache TTL 30 dias) + SSRF guard +
 * timeout. Esta camada apenas autentica e repassa.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ cnpj: string }> },
): Promise<NextResponse> {
  const { cnpj } = await ctx.params;
  const sanitized = cnpj.replace(/\D/g, '');
  if (sanitized.length !== 14) {
    return NextResponse.json(
      { code: 'INVALID_CNPJ', message: 'CNPJ deve ter 14 dígitos' },
      { status: 400 },
    );
  }

  try {
    const data = await fetchApi(`/api/integrations/cnpj/${sanitized}`);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof ApiError) {
      // Tenta repassar o body estruturado do apps/api
      try {
        const parsed = JSON.parse(err.bodyText) as Record<string, unknown>;
        return NextResponse.json(parsed, { status: err.status });
      } catch {
        return NextResponse.json(
          { code: 'UPSTREAM_ERROR', message: err.message },
          { status: err.status },
        );
      }
    }
    return NextResponse.json(
      { code: 'UPSTREAM_ERROR', message: (err as Error).message },
      { status: 500 },
    );
  }
}
