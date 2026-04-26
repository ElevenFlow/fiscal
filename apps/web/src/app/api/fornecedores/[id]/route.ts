/**
 * Route Handler proxy: /api/fornecedores/[id] (Plan 02-07 Task 2).
 *
 * GET (detalhe) + PATCH (update) + DELETE (soft delete).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const data = await fetchApi(`/api/fornecedores/${encodeURIComponent(id)}`);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const body = await req.text();
  try {
    const data = await fetchApi(`/api/fornecedores/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    await fetchApi(`/api/fornecedores/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

function apiErrorToResponse(err: unknown): NextResponse {
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
