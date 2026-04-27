/**
 * Placeholder de recuperação de senha (Plan 02.1-03).
 *
 * Reset por e-mail será implementado na Phase 7.1 (Plan 2 da Auth In-House),
 * que inclui integração com Resend/SES + verificação de email + rate limiting.
 *
 * Por enquanto: contate o administrador para redefinição manual via seed/psql.
 */
export default function RecuperarSenhaPage() {
  return (
    <div className="w-full space-y-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="text-sm text-muted-foreground">
        Reset de senha por e-mail ainda não disponível.
      </p>
      <p className="text-sm text-muted-foreground">
        Entre em contato com o administrador da sua contabilidade para redefinir sua senha.
      </p>
      <a href="/entrar" className="text-sm underline hover:text-primary">
        Voltar ao login
      </a>
    </div>
  );
}
