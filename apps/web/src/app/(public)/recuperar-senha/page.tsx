import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Recuperar senha' };

/**
 * /recuperar-senha — fluxo "Esqueci minha senha" do Clerk (FOUND-02).
 *
 * O componente <SignIn /> já inclui o link "Esqueci minha senha" internamente;
 * esta rota existe para ter uma URL pt-BR dedicada, útil em links de e-mail
 * ou no rodapé do /entrar. O routing usa hash para não colidir com /entrar.
 *
 * Tempo de expiração do link de reset: configurado pelo Clerk (default ≤ 1h).
 */
export default function RecuperarSenhaPage() {
  return (
    <SignIn
      signUpUrl="/cadastrar"
      fallbackRedirectUrl="/app"
      forceRedirectUrl="/app"
      routing="hash"
    />
  );
}
