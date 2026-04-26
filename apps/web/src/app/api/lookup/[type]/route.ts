/**
 * Route Handler proxy: /api/lookup/[type] (Plan 02-08, CAD-10).
 *
 * Proxia GET para apps/api `/api/lookup/{type}?q=...&limit=...` injetando
 * Bearer JWT (Clerk) server-side via fetchApi. Browser nunca vê o token.
 *
 * Tipos suportados: ncm | cest | cfop | lc116 (validação no backend; route
 * handler apenas encaminha).
 *
 * Cache: `force-dynamic` + `Cache-Control: no-store` no response — autocomplete
 * é endpoint de busca interativa; cache em CDN/browser não traz ganho real
 * (queries são variáveis) e poderia esconder atualizações pós-sync mensal.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const { type } = await ctx.params;
  const q = req.nextUrl.searchParams.get('q') ?? '';
  const limit = req.nextUrl.searchParams.get('limit') ?? '30';
  const qs = `q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;

  try {
    const data = await fetchApi(`/api/lookup/${encodeURIComponent(type)}?${qs}`);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(err.bodyText);
      } catch {
        parsed = { code: 'UPSTREAM_ERROR', message: err.bodyText };
      }
      return NextResponse.json(parsed, { status: err.status });
    }
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Internal error' },
      { status: 500 },
    );
  }
}
