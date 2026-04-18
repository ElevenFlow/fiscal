import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';
import { ExportDataButton } from '@/components/lgpd/export-data-button';
import { DeleteDataForm } from '@/components/lgpd/delete-data-form';

export const metadata: Metadata = { title: 'Privacidade' };

/**
 * Portal LGPD autenticado — ações do titular (FOUND-12).
 *
 * Usa shell do layout `(app)/` (Sidebar + Header do Plan 01-06).
 * Renderiza client components (ExportDataButton + DeleteDataForm) que chamam
 * route handlers same-origin `/api/lgpd/*` (BLOCKER #2 Option A).
 */
export default function PrivacidadeAppPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Seus dados</h1>
      <p className="text-muted-foreground">
        Acesso, correção e exclusão conforme LGPD Art. 18. Consulte também a{' '}
        <a className="text-brand-blue underline" href="/privacidade">
          política pública
        </a>
        .
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Acesso aos seus dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            Baixe um JSON com seu usuário, memberships e até 1.000 entradas recentes de audit
            associadas ao seu ID.
          </p>
          <ExportDataButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Correção de dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Para correção de nome, e-mail ou preferências, acesse{' '}
            <a className="text-brand-blue underline" href="/app/configuracoes">
              Configurações
            </a>{' '}
            ou contate o DPO:{' '}
            <a className="text-brand-blue underline" href="mailto:dpo@nexofiscal.com.br">
              dpo@nexofiscal.com.br
            </a>
            .
          </p>
          <p>Dados fiscais com valor legal exigem justificativa documentada.</p>
        </CardContent>
      </Card>

      <DeleteDataForm />

      <Card>
        <CardHeader>
          <CardTitle>Contato com o DPO</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            <a className="text-brand-blue underline" href="mailto:dpo@nexofiscal.com.br">
              dpo@nexofiscal.com.br
            </a>
          </p>
          <p className="pt-1 text-muted-foreground">
            Prazo de resposta: até 15 dias úteis (LGPD Art. 19).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
