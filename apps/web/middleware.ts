import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Middleware Clerk (Plan 02-09 — religado após período protótipo single-user).
 *
 * Estratégia:
 *  - Default: clerkMiddleware com allowlist de rotas públicas e protect() em rotas privadas.
 *  - Webhook /api/webhooks/* permanece público (svix valida assinatura no handler).
 *  - O cookie HMAC anterior (lib/session.ts) fica como FALLBACK opt-in via `USE_PROTOTYPE_AUTH=true`,
 *    mas NÃO é consumido por este middleware default. Para reativar o gate HMAC em emergência,
 *    consultar `docs/CLERK_SETUP.md` seção 10 ("Rollback para modo protótipo").
 */

const isPublic = createRouteMatcher([
  '/',
  '/entrar(.*)',
  '/cadastrar(.*)',
  '/recuperar-senha(.*)',
  '/privacidade(.*)',
  '/api/webhooks(.*)',
]);

const isProtected = createRouteMatcher([
  '/app(.*)',
  '/api/clientes(.*)',
  '/api/fornecedores(.*)',
  '/api/produtos(.*)',
  '/api/servicos(.*)',
  '/api/empresas(.*)',
  '/api/contabilidades(.*)',
  '/api/certificados(.*)',
  '/api/series(.*)',
  '/api/integrations(.*)',
  '/api/lookup(.*)',
  '/api/lgpd(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req) && !isPublic(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
