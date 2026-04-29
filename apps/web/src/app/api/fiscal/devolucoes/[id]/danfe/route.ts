import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const data = await fetchApi<{ filename: string; contentBase64: string }>(
      `/api/fiscal/devolucoes/${id}/danfe`,
    );
    return new NextResponse(Buffer.from(data.contentBase64, 'base64'), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${data.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
