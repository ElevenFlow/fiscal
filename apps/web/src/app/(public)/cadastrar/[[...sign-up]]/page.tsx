import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Cadastrar' };

/**
 * /cadastrar — cadastro Clerk em pt-BR (FOUND-01).
 * Clerk envia e-mail de verificação automaticamente; usuário cai em /app
 * após confirmar.
 */
export default function SignUpPage() {
  return (
    <SignUp
      signInUrl="/entrar"
      fallbackRedirectUrl="/app"
      forceRedirectUrl="/app"
      path="/cadastrar"
      routing="path"
    />
  );
}
