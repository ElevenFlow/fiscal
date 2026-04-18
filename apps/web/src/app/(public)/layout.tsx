import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Acesso', template: '%s · Nexo Fiscal' },
};

/**
 * Layout minimalista para rotas públicas (entrar, cadastrar, recuperar senha,
 * privacidade). Sem sidebar/header do shell autenticado.
 *
 * Rotas autenticadas ficam em `(app)/app/*` e usam o layout do Plan 06.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-brand-blue/5 to-brand-green/5 p-4">
      <div className="mb-8 select-none">
        <span className="text-3xl font-bold text-brand-blue">Nexo Fiscal</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
