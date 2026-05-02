import { forwardSetCookies } from '@/lib/set-cookie';
/**
 * POST /api/auth/signin — proxy transparente para apps/api AuthController.
 * Repassa cookies Set-Cookie do apps/api para o browser (T-02.1-03-05).
 */
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const apiRes = await fetch(`${API_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    cache: 'no-store',
  });

  const responseBody = await apiRes.text();
  const res = new NextResponse(responseBody, {
    status: apiRes.status,
    headers: { 'Content-Type': 'application/json' },
  });

  // Repassar Set-Cookie (nf_access + nf_refresh) do apps/api para o browser.
  forwardSetCookies(apiRes.headers, res.headers);

  return res;
}
