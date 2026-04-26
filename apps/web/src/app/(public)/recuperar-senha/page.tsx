import { SignIn } from '@clerk/nextjs';

/**
 * Página /recuperar-senha — alias para o fluxo "Esqueci senha" do Clerk SignIn.
 * Plan 02-09 religou. O componente SignIn já exibe o link "Esqueci minha senha"
 * que dispara o e-mail de redefinição (TTL ≤1h gerenciado pelo Clerk).
 *
 * `routing="hash"`: o fluxo de recuperação muda apenas o hash, mantendo a URL
 * estável e dispensando uma rota catch-all dedicada.
 */
export default function RecuperarSenhaPage() {
  return <SignIn routing="hash" />;
}
