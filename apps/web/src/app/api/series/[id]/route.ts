import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

/**
 * Route Handler: GET /api/series/[id] + PATCH /api/series/[id] + DELETE /api/series/[id]
 * (Plan 02-06).
 *
 * Proxy server-side via fetchApi — Bearer JWT injetado automaticamente.
 *
 * PATCH: usado para alternar `ambiente` (HOMOLOGACAO ↔ PRODUCAO) e `ativa`.
 * `proximoNumero` NÃO é editável via PATCH (ver SerieUpdateSchema) — só via
 * SeriesNumberingHelper na emissão real.
 *
 * DELETE: soft delete (ativa=false) — séries persistem para histórico fiscal.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const data = await fetchApi(`/api/series/${id}`);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const body = await req.text();
    const data = await fetchApi(`/api/series/${id}`, {
      method: 'PATCH',
      body,
    });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await fetchApi(`/api/series/${id}`, { method: 'DELETE' });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
