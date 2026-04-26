import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

/**
 * Route Handler proxy: GET /api/integrations/cep/:cep (Plan 02-03 Task 3).
 *
 * Proxia para apps/api `/api/integrations/cep/:cep` injetando Bearer JWT.
 * Backend (ViaCepService) faz cache (cep_cache TTL 90 dias) + SSRF guard.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ cep: string }> },
): Promise<NextResponse> {
  const { cep } = await ctx.params;
  const sanitized = cep.replace(/\D/g, '');
  if (sanitized.length !== 8) {
    return NextResponse.json(
      { code: 'INVALID_CEP', message: 'CEP deve ter 8 dígitos' },
      { status: 400 },
    );
  }

  try {
    const data = await fetchApi(`/api/integrations/cep/${sanitized}`);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof ApiError) {
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
