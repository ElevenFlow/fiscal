import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Aplicação',
};

/**
 * Layout do shell autenticado (Plan 06 + Plan 07).
 *
 * Proteção em camada dupla:
 *  1. `middleware.ts` já protege `/app(.*)` via `auth.protect()` (Plan 07).
 *  2. Este layout faz `auth()` server-side e redireciona para `/entrar`
 *     se `userId` estiver ausente — defesa em profundidade contra edge cases
 *     (middleware matcher divergente, request vindo de dev tools, etc).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/entrar');

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
