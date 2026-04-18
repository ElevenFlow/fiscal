import { type NextRequest, NextResponse } from 'next/server';

interface DeleteBody {
  reason?: string;
}

/**
 * MODO PROTÓTIPO: simula protocolo de exclusão LGPD sem backend real.
 *
 * Valida apenas o tamanho mínimo do motivo e retorna um ID fake. No modo real
 * (ver git log 01-09), o handler faz proxy autenticado para
 * apps/api POST /api/lgpd/deletion-request.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.reason || body.reason.trim().length < 10) {
    return NextResponse.json(
      { error: 'reason_required', detail: 'Motivo deve ter pelo menos 10 caracteres.' },
      { status: 400 },
    );
  }

  const protocoloId = `LGPD-${Date.now().toString(36).toUpperCase()}`;
  return NextResponse.json({ status: 'recebido', protocoloId });
}
