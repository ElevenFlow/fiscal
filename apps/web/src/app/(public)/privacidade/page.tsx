import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata: Metadata = { title: 'Política de privacidade' };

/**
 * Portal LGPD público — acessível sem login (FOUND-12).
 *
 * Atende LGPD Art. 9º (informação clara ao titular) + PITFALLS.md #16
 * (base legal e retenção documentadas). Rota autenticada correspondente:
 * `/app/privacidade` (ações do titular: exportar, corrigir, excluir).
 */
export default function PrivacidadePublicaPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Política de privacidade</h1>
      <p className="text-sm text-muted-foreground">
        Última atualização: {new Date().toISOString().slice(0, 10)}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Encarregado de Proteção de Dados (DPO)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Nome:</strong> (a definir na operação oficial)
          </p>
          <p>
            <strong>E-mail:</strong>{' '}
            <a className="text-brand-blue underline" href="mailto:dpo@nexofiscal.com.br">
              dpo@nexofiscal.com.br
            </a>
          </p>
          <p>
            <strong>Endereço:</strong> (a definir na operação oficial)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base legal e retenção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Base legal (LGPD Art. 7º II):</strong> cumprimento de obrigação legal ou
            regulatória. Dados fiscais (XMLs autorizados, DANFEs, audit trail) são tratados com
            base no CTN Arts. 173, 174 e 195, que exigem retenção mínima de 5 anos.
          </p>
          <p>
            <strong>Retenção de XMLs fiscais:</strong> 6 anos em S3 Object Lock Compliance Mode
            (imutável). Não podem ser excluídos antes do prazo nem mesmo a pedido do titular.
          </p>
          <p>
            <strong>Retenção de audit log:</strong> 5+ anos, com trigger de imutabilidade no
            Postgres.
          </p>
          <p>
            <strong>Dados de marketing e preferências:</strong> até revogação do consentimento.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direitos do titular (LGPD Art. 18)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="ml-6 list-decimal space-y-1">
            <li>Confirmação da existência de tratamento</li>
            <li>
              Acesso aos dados (exportação disponível em{' '}
              <a className="text-brand-blue underline" href="/app/privacidade">
                /app/privacidade
              </a>
              )
            </li>
            <li>Correção de dados incompletos, inexatos ou desatualizados</li>
            <li>Anonimização, bloqueio ou eliminação (respeitada a retenção fiscal legal)</li>
            <li>Portabilidade dos dados</li>
            <li>Informação sobre compartilhamento</li>
          </ol>
          <p className="pt-3">
            Para exercer esses direitos, entre em contato com o DPO em{' '}
            <a className="text-brand-blue underline" href="mailto:dpo@nexofiscal.com.br">
              dpo@nexofiscal.com.br
            </a>
            . Prazo de resposta: até 15 dias úteis (LGPD Art. 19).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
