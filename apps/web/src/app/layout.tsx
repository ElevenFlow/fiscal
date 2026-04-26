import { ptBR } from '@clerk/localizations';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { AppQueryProvider } from '@/lib/query-client';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Nexo Fiscal',
    template: '%s · Nexo Fiscal',
  },
  description: 'SaaS fiscal brasileiro — emissão NFS-e, NF-e e devolução em menos de um minuto.',
  applicationName: 'Nexo Fiscal',
  icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1E5FD8',
};

/**
 * Plan 02-09 — Clerk Organizations religado após período protótipo single-user.
 *
 * fallbackPublishableKey: chave dummy estruturalmente válida (`foo.clerk.dev$` em b64url)
 * usada SOMENTE quando `.env` está com placeholder `pk_test_REPLACE_ME`. Evita crash do
 * prerender de `/_not-found` (Next 15 pre-renderiza estática sob o ClerkProvider).
 * Em runtime real, `CLERK_SECRET_KEY` inválida no backend rejeita tokens — não há bypass.
 */
const fallbackPublishableKey = 'pk_test_Zm9vLmNsZXJrLmRldiQ';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const envKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const publishableKey =
    !envKey || envKey.includes('REPLACE_ME') ? fallbackPublishableKey : envKey;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={ptBR}
      appearance={{
        variables: { colorPrimary: '#1E5FD8' },
        elements: { formButtonPrimary: 'bg-brand-blue hover:opacity-90' },
      }}
    >
      <html lang="pt-BR" suppressHydrationWarning>
        <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
          <AppQueryProvider>{children}</AppQueryProvider>
          <Toaster richColors position="top-right" closeButton />
        </body>
      </html>
    </ClerkProvider>
  );
}
