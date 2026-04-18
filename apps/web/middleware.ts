import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Rotas que EXIGEM autenticação.
 *  - `/app/*` — shell autenticado (Plan 06)
 *  - `/api/empresas|notas|lgpd/*` — proxies Next.js que falam com apps/api
 */
const isProtectedRoute = createRouteMatcher([
  '/app(.*)',
  '/api/empresas(.*)',
  '/api/notas(.*)',
  '/api/lgpd(.*)',
]);

/**
 * Rotas públicas (nunca redirecionam para /entrar).
 *  - `/entrar`, `/cadastrar`, `/recuperar-senha` — auth UI Clerk
 *  - `/privacidade` — política LGPD pública (Plan 09)
 *  - `/api/webhooks/*` — webhook Clerk, assinado via svix
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/entrar(.*)',
  '/cadastrar(.*)',
  '/recuperar-senha(.*)',
  '/privacidade(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Pula internals do Next.js e arquivos estáticos
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Sempre roda para rotas de API / trpc
    '/(api|trpc)(.*)',
  ],
};
