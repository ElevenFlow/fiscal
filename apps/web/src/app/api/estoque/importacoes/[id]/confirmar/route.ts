import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = await req.text();
  try {
    const data = await fetchApi(`/api/estoque/importacoes/${id}/confirmar`, {
      method: 'POST',
      body,
    });
    return NextResponse.json(data);
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
