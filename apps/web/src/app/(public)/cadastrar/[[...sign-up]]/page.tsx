import { SignUp } from '@clerk/nextjs';

/**
 * Página /cadastrar — Clerk SignUp com pt-BR. Plan 02-09 religou.
 *
 * Após cadastro, usuário cai em /app/dashboard (fallbackRedirectUrl). O webhook
 * Clerk (`/api/webhooks/clerk`) cria User+UserMembership no Postgres.
 */
export default function SignUpPage() {
  return (
    <SignUp
      signInUrl="/entrar"
      fallbackRedirectUrl="/app/dashboard"
      path="/cadastrar"
      routing="path"
    />
  );
}
