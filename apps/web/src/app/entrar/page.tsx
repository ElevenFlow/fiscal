'use client';

import { Button, Input } from '@nexo/ui';
import { Quote, ShieldCheck } from 'lucide-react';
import { useActionState } from 'react';
import { type LoginState, loginAction } from './actions';

const initialState: LoginState = { error: null };

/**
 * Tela de login — modo protótipo single-user.
 * Credenciais validadas em Server Action contra env vars AUTH_EMAIL/AUTH_PASSWORD.
 * Sucesso seta cookie assinado e redireciona para `/`.
 */
export default function EntrarPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Painel esquerdo — branding */}
      <aside className="relative flex flex-col justify-between bg-brand-blue p-8 text-white md:w-1/2 md:p-12">
        <div>
          <div className="text-3xl font-bold tracking-tight">Nexo Fiscal</div>
          <p className="mt-2 max-w-sm text-sm text-white/80">
            Emita qualquer nota fiscal em menos de um minuto, com sua contabilidade enxergando tudo
            em tempo real.
          </p>
        </div>

        <div className="hidden md:block">
          <div className="rounded-xl bg-white/10 p-6 backdrop-blur">
            <Quote className="mb-3 h-6 w-6 text-white/70" />
            <p className="text-base leading-relaxed">
              “Unificamos a emissão fiscal de 34 empresas em um único ambiente. Nossa equipe
              contábil recuperou dias de trabalho todo mês.”
            </p>
            <div className="mt-4 text-sm text-white/80">
              <div className="font-semibold">Luciana Almeida</div>
              <div>Sócia, Sigma Contabilidade</div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-2 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4" />
            <span>Certificado A1, LGPD e auditoria fiscal com retenção de 5 anos.</span>
          </div>
        </div>

        <div className="text-xs text-white/60">
          © {new Date().getFullYear()} Nexo Fiscal — Todos os direitos reservados.
        </div>
      </aside>

      {/* Painel direito — formulário */}
      <main className="flex flex-1 items-center justify-center bg-background p-6 md:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Entrar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use seu e-mail corporativo para acessar a plataforma.
            </p>
          </div>

          <form action={formAction} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                E-mail
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue=""
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="senha" className="text-sm font-medium">
                Senha
              </label>
              <Input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
              />
            </div>

            {state.error && (
              <div
                role="alert"
                className="rounded-md border border-brand-danger/30 bg-brand-danger/10 p-3 text-sm text-brand-danger"
              >
                {state.error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
