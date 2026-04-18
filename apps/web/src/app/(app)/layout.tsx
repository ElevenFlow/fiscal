import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { MockAuthProvider } from '@/lib/mock-auth';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aplicação',
};

// MODO PROTÓTIPO: sem auth real. `MockAuthProvider` carrega o usuário fake a
// partir de localStorage e alimenta o switcher de perfil no header.
// Para restaurar Clerk, consultar git log 01-07.
export default function AppLayout({ children }: { children: React.ReactNode }) {
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
