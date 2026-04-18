'use client';

import { Button, Input } from '@nexo/ui';
import { Quote, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

/**
 * Tela de login (MODO PROTÓTIPO — visual apenas).
 *
 * Split-screen:
 *  - Esquerda: painel azul com branding e depoimento.
 *  - Direita: card centralizado com email / senha / manter conectado.
 *
 * Submissão: apenas redireciona para `/` — nenhum backend envolvido. Esquecer
 * senha mostra toast/alert em dev mock.
 */
export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState('rodrigo@oliveiratech.com.br');
  const [senha, setSenha] = useState('••••••••');
  const [manterConectado, setManterConectado] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simula latência curta para sensação de "entrando…"
    setTimeout(() => router.push('/'), 450);
  };

  const handleEsqueci = () => {
    alert('Modo protótipo: funcionalidade mock. Em produção envia e-mail de recuperação.');
  };

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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="senha" className="text-sm font-medium">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={handleEsqueci}
                  className="text-xs font-medium text-brand-blue hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={manterConectado}
                onChange={(e) => setManterConectado(e.target.checked)}
                className="h-4 w-4 rounded border-input text-brand-blue focus:ring-brand-blue"
              />
              <span>Manter conectado</span>
            </label>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Modo protótipo — qualquer credencial entra no ambiente de demonstração.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
