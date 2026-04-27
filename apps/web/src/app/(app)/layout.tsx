import type { Metadata } from 'next';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { requireSession } from '@/lib/auth';
import { MockAuthProvider } from '@/lib/mock-auth';

export const metadata: Metadata = {
  title: 'Aplicação',
};

/**
 * Layout autenticado (Plan 02.1-03 — auth in-house).
 *
 * Defesa em profundidade sobre o middleware:
 *  - Middleware JWT já bloqueia rotas /app(.*) sem cookie nf_access válido.
 *  - Aqui, requireSession() faz um segundo check via jwtVerify + cookies()
 *    server-side — redireciona /entrar se sessão ausente ou inválida.
 *
 * MockAuthProvider permanece como camada de RBAC visual ("Ver como…")
 * até Phase 7.1 plugar roles reais do JWT.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Double-check: middleware já garante sessão válida, mas layout verifica também.
  await requireSession('/entrar');

  return (
    <MockAuthProvider>
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
