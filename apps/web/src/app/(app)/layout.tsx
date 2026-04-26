import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '@/components/shell/header';
import { HomologationBannerMount } from '@/components/shell/homologation-banner-mount';
import { Sidebar } from '@/components/shell/sidebar';
import { getCurrentUser } from '@/lib/clerk-shim';
import { MockAuthProvider } from '@/lib/mock-auth';

export const metadata: Metadata = {
  title: 'Aplicação',
};

/**
 * Layout autenticado (Plan 02-09 — Clerk religado).
 *
 * Defesa em profundidade sobre o middleware:
 *  - Middleware Clerk já bloqueia rotas /app(.*) sem JWT válido.
 *  - Aqui, fazemos um SECOND check via `getCurrentUser()` (clerk-shim) que
 *    cobre Clerk default + cookie HMAC fallback (USE_PROTOTYPE_AUTH=true).
 *  - Sem userId → redirect /entrar.
 *
 * MockAuthProvider permanece como camada de protótipo de RBAC visual ("Ver como…")
 * até Phase 2 plugar publicMetadata.role real do Clerk.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me.userId) {
    redirect('/entrar');
  }

  return (
    <MockAuthProvider>
      {/*
        Banner CERT-07 (Plan 02-06) — sticky topo, amarelo. Aparece quando
        empresa atual tem série ativa em HOMOLOGACAO. Server component faz
        fetch /api/series e decide. Falha do fetch -> banner não aparece
        (default safe). Defesa real fica no guard backend assertEnvironmentMatch.
      */}
      <HomologationBannerMount />
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </div>
      </div>
    </MockAuthProvider>
  );
}
