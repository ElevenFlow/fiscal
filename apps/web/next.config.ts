import type { NextConfig } from 'next';

/**
 * Next.js 16 config — modo App Router, transpilação do @nexo/ui (workspace).
 *
 * Routing:
 * - Route group `(app)` não prefixa URL: dashboard é servido em `/`.
 * - Plan 02-09 religou Clerk: rotas públicas `/entrar`, `/cadastrar`, `/recuperar-senha`.
 *
 * Build runner: package.json roda `next build --webpack`. Turbopack 16.2.4 tem bug de
 * resolução de symlinks pnpm em alguns ambientes Windows quando o worktree está sob
 * `.claude/worktrees/<id>/` do projeto-mãe; webpack resolve corretamente. Este override
 * é apenas para o build artifact; `next dev` continua usando Turbopack por velocidade.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Necessário porque @nexo/ui exporta TS direto (sem build prévio).
  transpilePackages: ['@nexo/ui', '@nexo/shared'],
};

export default nextConfig;
