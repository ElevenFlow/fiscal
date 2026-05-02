import { ApiError, fetchApi } from '@/lib/api-client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Route Handler: GET /api/series + POST /api/series (Plan 02-06).
 *
 * Proxia para apps/api `/api/series` via fetchApi (Bearer Clerk auto).
 * GET retorna lista de séries do tenant ativo; POST cria nova série.
 *
 * Em modo protótipo (USE_PROTOTYPE_AUTH=true), o token Clerk é null e
 * apps/api via ALLOW_HEADER_AUTH cobre o smoke. Em prod, Bearer obrigatório.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  try {
    const data = await fetchApi('/api/series', { tenantId });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.text();
    const data = await fetchApi('/api/series', {
      method: 'POST',
      body,
    });
    return NextResponse.json(data, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
