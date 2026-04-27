/**
 * POST /api/auth/refresh — proxy transparente para apps/api AuthController.
 * Repassa nf_refresh cookie; apps/api valida, gera novo access + refresh,
 * retorna Set-Cookie com tokens rotacionados (T-02.1-03-03, T-02.1-03-06).
 */
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const apiRes = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  const responseBody = await apiRes.text();
  const res = new NextResponse(responseBody, {
    status: apiRes.status,
    headers: { 'Content-Type': 'application/json' },
  });

  // Repassar Set-Cookie com tokens rotacionados
  const setCookie = apiRes.headers.get('set-cookie');
  if (setCookie) res.headers.set('set-cookie', setCookie);

  return res;
}
