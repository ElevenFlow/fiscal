/**
 * GET /api/auth/me — proxy transparente para apps/api AuthController.
 * Repassa cookie nf_access; apps/api retorna user + memberships.
 */
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const apiRes = await fetch(`${API_URL}/api/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  const responseBody = await apiRes.text();
  return new NextResponse(responseBody, {
    status: apiRes.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
