import { ApiError, fetchApi } from '@/lib/api-client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  try {
    const data = await fetchApi('/api/fiscal/nfe', { tenantId });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  try {
    const data = await fetchApi('/api/fiscal/nfe/drafts', { method: 'POST', body, tenantId });
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
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Internal error' }, { status: 500 });
}
