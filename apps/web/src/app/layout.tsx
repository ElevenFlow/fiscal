import { ptBR } from '@clerk/localizations';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
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
  themeColor: '#1E5FD8', // brand blue
};

/**
 * Publishable key resolver.
 *
 * O Clerk valida estrito o formato `pk_test_<base64>` no componente do provider,
 * portanto o placeholder literal `pk_test_REPLACE_ME` do `.env.example` faz o build
 * de páginas estáticas quebrar (`/_not-found`, etc).
 *
 * Uso de build fallback: `pk_test_Zm9vLmNsZXJrLmRldiQ` (decodifica `foo.clerk.dev$`)
 * — chave DUMMY válida estruturalmente que permite pre-rendering; runtime real
 * exige a chave do Dashboard Clerk (ver docs/CLERK_SETUP.md passo 3).
 *
 * Em produção, `CLERK_SECRET_KEY` no backend recusa tokens se a publishable/secret
 * não bate — então esse fallback não é risco de segurança, apenas DX.
 */
const BUILD_FALLBACK_PUBLISHABLE_KEY = 'pk_test_Zm9vLmNsZXJrLmRldiQ';
const publishableKey = (() => {
  const raw = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!raw || raw.includes('REPLACE_ME')) return BUILD_FALLBACK_PUBLISHABLE_KEY;
  return raw;
})();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={ptBR}
      appearance={{
        variables: {
          colorPrimary: '#1E5FD8',
          colorText: '#0f172a',
          colorBackground: '#ffffff',
          borderRadius: '0.5rem',
          fontFamily: 'var(--font-sans)',
        },
        elements: {
          formButtonPrimary: 'bg-brand-blue hover:opacity-90',
          card: 'shadow-lg',
        },
      }}
    >
      <html lang="pt-BR" suppressHydrationWarning>
        <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
