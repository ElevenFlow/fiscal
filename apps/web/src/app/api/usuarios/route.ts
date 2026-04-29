import { ApiError, fetchApi } from '@/lib/api-client';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const data = await fetchApi(`/api/usuarios${qs ? `?${qs}` : ''}`);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return apiErrorToResponse(err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const data = await fetchApi('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify(await req.json()),
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
