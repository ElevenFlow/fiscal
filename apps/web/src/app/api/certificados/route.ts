import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

/**
 * Route Handler: GET /api/certificados + POST /api/certificados (Plan 02-04).
 *
 * GET: proxia para apps/api `/api/certificados` via fetchApi (Bearer Clerk auto).
 *
 * POST: upload multipart/form-data com `file` (.pfx) + `password`. fetchApi não
 * suporta multipart binário diretamente (precisa preservar FormData), então o
 * proxy aqui re-emite a request com Bearer JWT manualmente, mantendo o stream.
 *
 * Em modo protótipo (USE_PROTOTYPE_AUTH=true), o token Clerk é null e o apps/api
 * via ALLOW_HEADER_AUTH cobre o smoke. Em prod, Bearer é obrigatório.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const data = await fetchApi('/api/certificados');
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Reaproveita o multipart do request original — não desserializa o file
  // no Node.js (mantém ArrayBuffer streaming até apps/api).
  const formData = await req.formData();

  // Injeção de Bearer: re-uso do mecanismo do api-client. Quando USE_PROTOTYPE_AUTH=true,
  // token = null e apps/api fallback ALLOW_HEADER_AUTH cobre o smoke (dev only).
  let token: string | null = null;
  if (process.env.USE_PROTOTYPE_AUTH !== 'true') {
    try {
      const { auth } = await import('@clerk/nextjs/server');
      const session = await auth();
      token = await session.getToken();
    } catch {
      // sessão indisponível — apps/api rejeitará 401 (esperado em rota protegida)
    }
  }

  const apiUrl =
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') +
    '/api/certificados';

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const upstream = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: formData,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'Content-Type':
        upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
