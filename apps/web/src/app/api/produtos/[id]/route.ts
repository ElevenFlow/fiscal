/**
 * Route Handler proxy: /api/produtos/[id] (Plan 02-07 Task 2).
 *
 * GET (detalhe) + PATCH (update) + DELETE (soft delete).
 */

import { ApiError, fetchApi } from '@/lib/api-client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const tenantId = await resolveTenantId(_req);
  try {
    const data = await fetchApi(`/api/produtos/${encodeURIComponent(id)}`, { tenantId });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const body = await req.text();
  const tenantId = await resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json(
      { code: 'MISSING_TENANT', message: 'Selecione uma empresa para alterar o produto.' },
      { status: 400 },
    );
  }
  try {
    const data = await fetchApi(`/api/produtos/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
      tenantId,
    });
    return NextResponse.json(data);
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const tenantId = await resolveTenantId(_req);
  if (!tenantId) {
    return NextResponse.json(
      { code: 'MISSING_TENANT', message: 'Selecione uma empresa para desativar o produto.' },
      { status: 400 },
    );
  }
  try {
    await fetchApi(`/api/produtos/${encodeURIComponent(id)}`, { method: 'DELETE', tenantId });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

async function resolveTenantId(req: NextRequest): Promise<string | null> {
  const explicit = req.nextUrl.searchParams.get('tenantId');
  if (explicit) return explicit;
  return firstEmpresaId();
}

async function firstEmpresaId(): Promise<string | null> {
  try {
    const data = await fetchApi<unknown>('/api/empresas/minhas');
    const empresas = Array.isArray(data)
      ? data
      : Array.isArray((data as { empresas?: unknown[] }).empresas)
        ? (data as { empresas: unknown[] }).empresas
        : [];
    const first = empresas.find(
      (empresa): empresa is { id: string } =>
        typeof empresa === 'object' &&
        empresa !== null &&
        typeof (empresa as { id?: unknown }).id === 'string',
    );
    return first?.id ?? null;
  } catch {
    return null;
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
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Internal error' }, { status: 500 });
}
