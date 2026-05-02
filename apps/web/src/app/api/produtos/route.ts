/**
 * Route Handler proxy: /api/produtos (Plan 02-07 Task 2).
 *
 * Lista (GET) e cria (POST) — proxia ao apps/api injetando Bearer JWT
 * server-side via fetchApi (Plan 02-09 + 02-02). Browser nunca vê o JWT.
 */

import { ApiError, fetchApi } from '@/lib/api-client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const qs = req.nextUrl.searchParams.toString();
  const tenantId = await resolveTenantId(req);
  try {
    const data = await fetchApi(`/api/produtos${qs ? `?${qs}` : ''}`, { tenantId });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const tenantId = await resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json(
      { code: 'MISSING_TENANT', message: 'Selecione uma empresa para cadastrar o produto.' },
      { status: 400 },
    );
  }
  try {
    const data = await fetchApi('/api/produtos', { method: 'POST', body, tenantId });
    return NextResponse.json(data, { status: 201 });
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
