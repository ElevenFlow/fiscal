import type { Metadata } from 'next';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';

export const metadata: Metadata = {
  title: 'Aplicação',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
