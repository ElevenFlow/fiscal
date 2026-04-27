import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

/**
 * Root layout — Plan 02.1-03 (auth in-house).
 * ClerkProvider removido. AppQueryProvider removido (não existe neste branch ainda;
 * será adicionado via merge de main quando 02-07 for integrado).
 */

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
