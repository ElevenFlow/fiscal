/**
 * Route Handler proxy: /api/contabilidades (Plan 02-07 Task 2).
 *
 * Lista (GET) e cria (POST) — proxia ao apps/api injetando Bearer JWT
 * server-side via fetchApi (Plan 02-09 + 02-02). Browser nunca vê o JWT.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const qs = req.nextUrl.searchParams.toString();
  try {
    const data = await fetchApi(`/api/contabilidades${qs ? `?${qs}` : ''}`);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  try {
    const data = await fetchApi('/api/contabilidades', { method: 'POST', body });
    return NextResponse.json(data, { status: 201 });
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
