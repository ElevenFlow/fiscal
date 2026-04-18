import { fetchApi } from '@/lib/api-client';
import { type NextRequest, NextResponse } from 'next/server';

interface DeleteBody {
  reason?: string;
}

/**
 * Next.js Route Handler — proxy autenticado para apps/api POST /api/lgpd/deletion-request.
 *
 * Veja rationale em `export/route.ts`. Mesma Option A (BLOCKER #2).
 *
 * Client component `<DeleteDataForm />` chama POST /api/lgpd/delete (same-origin);
 * este handler faz forward server-side para apps/api /api/lgpd/deletion-request.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.reason || body.reason.length < 10) {
    return NextResponse.json(
      { error: 'reason_required', detail: 'Motivo deve ter pelo menos 10 caracteres.' },
      { status: 400 },
    );
  }

  try {
    const result = await fetchApi<{ status: string; protocoloId: string }>(
      '/api/lgpd/deletion-request',
      {
        method: 'POST',
        body: JSON.stringify({ reason: body.reason }),
      },
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    const status = /401|403/.test(message) ? 401 : 500;
    return NextResponse.json({ error: 'lgpd_delete_failed', detail: message }, { status });
  }
}
