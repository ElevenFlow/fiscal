/**
 * POST /api/auth/signout — proxy transparente para apps/api AuthController.
 * Repassa nf_refresh cookie para apps/api revogar a sessão no DB.
 * apps/api retorna Set-Cookie com cookies expirados (clear).
 */
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  // Repassa todos os cookies para apps/api poder revogar a sessão pelo nf_refresh
  const cookieHeader = req.headers.get('cookie') ?? '';
  const apiRes = await fetch(`${API_URL}/api/auth/signout`, {
    method: 'POST',
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  const res = new NextResponse(null, { status: apiRes.status });

  // Repassar clear-cookie do apps/api para o browser
  const setCookie = apiRes.headers.get('set-cookie');
  if (setCookie) res.headers.set('set-cookie', setCookie);

  return res;
}
