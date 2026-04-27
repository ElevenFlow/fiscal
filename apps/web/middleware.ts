import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Middleware de auth JWT cookie — Plan 02.1-03 (auth in-house).
 *
 * Lê o cookie nf_access, verifica JWT (auth in-house Phase 02.1).
 * Se expirado + nf_refresh presente, tenta refresh server-side.
 * Sem token válido → redirect /entrar?next={pathname}.
 *
 * Runtime nodejs (não Edge) para usar jose + fetch interno no refresh.
 */

// Constantes (espelham apps/api auth.guard.ts)
const ACCESS_COOKIE = 'nf_access';
const REFRESH_COOKIE = 'nf_refresh';

// Rotas públicas — não exigem autenticação
const PUBLIC_PATHS = ['/', '/entrar', '/cadastrar', '/recuperar-senha', '/privacidade'];

function isPublicPath(pathname: string): boolean {
  // /api/auth/* é público (proxy para apps/api public endpoints)
  if (pathname.startsWith('/api/auth/')) return true;
  // /api/webhooks/* — sem webhook Clerk, mas manter por compatibilidade futura
  if (pathname.startsWith('/api/webhooks/')) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Whitelist de paths para o parâmetro `next` (previne open redirect — T-02.1-03-01)
function isSafeNextPath(next: string): boolean {
  try {
    if (next.startsWith('//') || next.includes('://')) return false;
    return next.startsWith('/') && !next.startsWith('//');
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  // Verificar access token via jwtVerify (nodejs runtime — T-02.1-03-04)
  if (accessToken) {
    try {
      const secret = new TextEncoder().encode(
        process.env.AUTH_JWT_SECRET ?? 'dev-only-insecure-jwt-secret-nexofiscal-2026!!',
      );
      await jwtVerify(accessToken, secret, { algorithms: ['HS256'] });
      return NextResponse.next();
    } catch {
      // Token expirado ou inválido — tentar refresh abaixo
    }
  }

  // Tentar refresh server-side se nf_refresh presente (T-02.1-03-03)
  if (refreshToken) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const refreshRes = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        },
        cache: 'no-store',
      });
      if (refreshRes.ok) {
        // apps/api seta Set-Cookie na response — repassar para o browser
        const setCookieHeader = refreshRes.headers.get('set-cookie');
        const response = NextResponse.next();
        if (setCookieHeader) {
          response.headers.set('set-cookie', setCookieHeader);
        }
        return response;
      }
    } catch {
      // Refresh falhou — redirecionar para login
    }
  }

  // Sem autenticação válida → redirect /entrar
  const next = pathname + req.nextUrl.search;
  const safeNext = isSafeNextPath(next) ? next : '/app';
  const loginUrl = new URL(`/entrar?next=${encodeURIComponent(safeNext)}`, req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
  runtime: 'nodejs',
};
