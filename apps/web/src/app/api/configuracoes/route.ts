import { ApiError, fetchApi } from '@/lib/api-client';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const data = await fetchApi('/api/configuracoes');
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const section = String(body.section ?? 'empresa');
    const path =
      section === 'email'
        ? '/api/configuracoes/email'
        : section === 'preferencias'
          ? '/api/configuracoes/preferencias'
          : '/api/configuracoes/empresa';
    const data = await fetchApi(path, {
      method: 'PATCH',
      body: JSON.stringify(body.data ?? body),
    });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
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
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Internal error' }, { status: 500 });
}
