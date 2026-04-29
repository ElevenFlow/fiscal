import { ApiError, fetchApi } from '@/lib/api-client';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const data = await fetchApi(`/api/usuarios/${encodeURIComponent(id)}/acao`, {
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
