import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, getAuthSecret, verifySession } from '@/lib/session';

/**
 * Middleware de auth — modo protótipo single-user.
 *
 * Regras:
 *  - `/entrar`, `/privacidade` e `/api/auth/*` são públicos.
 *  - Qualquer outra rota exige cookie de sessão HMAC válido; caso contrário
 *    redireciona para `/entrar?next=<path>`.
 *  - Usuário já autenticado acessando `/entrar` é mandado para `/`.
 *
 * Quando restaurar Clerk, trocar este arquivo pelo `clerkMiddleware` original
 * (ver git log 01-07).
 */

const PUBLIC_PATHS = ['/entrar', '/privacidade', '/app/privacidade'];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth/')) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token, getAuthSecret()) : null;

  // Autenticado tentando /entrar → manda para home
  if (session && pathname === '/entrar') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Não autenticado tentando rota protegida → manda para /entrar
  if (!session && !isPublicPath(pathname)) {
    const url = new URL('/entrar', req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
