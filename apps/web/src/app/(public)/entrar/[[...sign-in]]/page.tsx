import { SignIn } from '@clerk/nextjs';

/**
 * Página /entrar — Clerk SignIn com pt-BR localization (configurada no
 * ClerkProvider em apps/web/src/app/layout.tsx). Plan 02-09 religou.
 *
 * `path`/`routing="path"`: Clerk usa rotas catch-all (`[[...sign-in]]`) para
 * suportar fluxos multi-step (verificação, MFA, etc.) sem mudar de URL.
 */
export default function SignInPage() {
  return (
    <SignIn
      signUpUrl="/cadastrar"
      fallbackRedirectUrl="/app/dashboard"
      path="/entrar"
      routing="path"
    />
  );
}
