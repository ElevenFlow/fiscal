import type { NextConfig } from 'next';

/**
 * Next.js 15 config — modo App Router, transpilação do @nexo/ui (workspace).
 *
 * Routing:
 * - Route group `(app)` não prefixa URL: dashboard é servido em `/`.
 * - Rotas placeholder: `/documentos`, `/emitir`, `/cadastros`, `/alertas`, `/config`.
 * - Plan 07 (Clerk) introduz rotas públicas `/entrar` + middleware de autenticação.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Necessário porque @nexo/ui exporta TS direto (sem build prévio).
  transpilePackages: ['@nexo/ui', '@nexo/shared'],
  experimental: {
    // React 19 compat
    reactCompiler: false,
  },
};

export default nextConfig;
