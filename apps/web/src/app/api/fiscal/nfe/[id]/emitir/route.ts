import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const data = await fetchApi(`/api/fiscal/nfe/${id}/emitir`, { method: 'POST' });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
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
}
