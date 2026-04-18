import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Entrar' };

/**
 * /entrar — tela de login Clerk em pt-BR (FOUND-01, FOUND-03).
 * Rota catch-all `[[...sign-in]]` permite que o Clerk roteie steps internos
 * (MFA, verificação de e-mail) sem sair do domínio Nexo.
 */
export default function SignInPage() {
  return (
    <SignIn
      signUpUrl="/cadastrar"
      fallbackRedirectUrl="/app"
      forceRedirectUrl="/app"
      path="/entrar"
      routing="path"
    />
  );
}
