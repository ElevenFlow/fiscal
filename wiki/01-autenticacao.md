# 01 — Autenticação (in-house JWT + argon2)

> **Phase 2.1 (2026-04-26):** Clerk Organizations foi removido e substituído por
> autenticação própria (JWT HS256 + argon2id + sessions com refresh rotation).
> Histórico do Clerk: ver `docs/CLERK_SETUP.md` (marcado como OBSOLETO).

## Visão geral

Autenticação JWT HS256 in-house com argon2id para hashing de senhas:

- **User** → tabela `users` com `password_hash` (argon2id, NIST SP 800-63B)
- **Session** → tabela `sessions` com `refresh_token_hash` (sha256) e `expires_at`
- **Access token** → cookie `nf_access` (HttpOnly, 15 min, JWT HS256)
- **Refresh token** → cookie `nf_refresh` (HttpOnly, 7 dias, opaque 32 bytes hex)

Login e signup usam formulários RHF+Zod próprios em `/entrar` e `/cadastrar`.
Sem dependência de provedor externo — sem Clerk, sem OAuth no MVP.

## Status atual

| Componente | Status |
|-----------|--------|
| AuthGuard (NestJS) — valida cookie nf_access | Completo |
| AuthController — signup/signin/signout/refresh/me | Completo |
| PasswordService — argon2id hash + verify | Completo |
| JwtService — HS256 sign/verify + signRefresh | Completo |
| SessionsService — refresh rotation single-use | Completo |
| Middleware Next.js — valida cookie + refresh automático | Completo |
| Páginas /entrar e /cadastrar (RHF+Zod) | Completo |
| Route Handlers proxy (apps/web → apps/api) | Completo |
| Seed 1º admin (admin@nexofiscal.local) | Completo |
| Reset de senha por email | Planejado (Phase 7.1) |
| MFA / TOTP | Planejado (Phase 7.1) |
| Rate limiting de login | Planejado (Phase 7.1) |
| Convites de usuário por email | Planejado (Phase 7.1) |

## Arquivos envolvidos

### Backend (apps/api)

- `src/modules/auth/auth.module.ts` — AuthModule @Global
- `src/modules/auth/auth.guard.ts` — AuthGuard + @Public() decorator + AuthContext
- `src/modules/auth/auth.controller.ts` — endpoints signup/signin/signout/refresh/me
- `src/modules/auth/auth.service.ts` — lógica de negócio principal
- `src/modules/auth/password.service.ts` — argon2id hash + verify
- `src/modules/auth/jwt.service.ts` — jose HS256 sign/verify + signRefresh opaque
- `src/modules/auth/sessions.service.ts` — CRUD de sessions no Postgres

### Frontend (apps/web)

- `middleware.ts` — verifica nf_access; refresh automático via nf_refresh
- `src/lib/auth.ts` — getSession() / requireSession() server-only helpers
- `src/lib/session.ts` — constantes de cookie (nf_access, nf_refresh)
- `src/lib/api-client.ts` — fetchApi com nf_access cookie como Bearer
- `src/lib/tenant-resolver.ts` — resolve tenant do JWT (sem Clerk)
- `src/app/(public)/entrar/page.tsx` — formulário signin RHF+Zod
- `src/app/(public)/cadastrar/page.tsx` — formulário signup RHF+Zod
- `src/app/api/auth/{signup,signin,signout,refresh,me}/route.ts` — proxies Route Handlers

### Shared

- `packages/shared/src/auth/schemas.ts` — SignupSchema + SigninSchema (Zod)

### Docs

- `docs/AUTH.md` — documentação completa do fluxo in-house

## Variáveis de ambiente

```env
# Mínimo 32 chars — gerar com: openssl rand -hex 32
AUTH_JWT_SECRET=<secret-real-aqui>

# true apenas em dev para integration tests sem JWT real
ALLOW_HEADER_AUTH=false
```

Ver `docs/AUTH.md` para instruções completas de geração e uso.

## Diagrama de fluxo simplificado

```
[Browser] POST /api/auth/signin (email + senha)
    → [Route Handler apps/web] → proxy para apps/api
    → [AuthController] → PasswordService.verify → SessionsService.create
    → Set-Cookie: nf_access (15min), nf_refresh (7d)

[Browser] GET /app/dashboard
    → [middleware.ts] → jwtVerify(nf_access) → ok → next
    → [Server Component] → requireSession() → ok
    → [fetchApi] → Authorization: Bearer nf_access → apps/api
    → [AuthGuard] → jwtVerify → req.auth → handler
```

---

## Histórico — Clerk Organizations (removido em Phase 02.1)

> Esta seção preserva o registro histórico da implementação anterior.
> O código Clerk foi removido integralmente em Phase 02.1 (2026-04-26).
> Ver `docs/CLERK_SETUP.md` para o runbook completo (marcado como OBSOLETO).

A implementação anterior usava **Clerk Organizations** como provedor de identidade:

- `@clerk/nextjs` + `@clerk/localizations` no apps/web
- `@clerk/backend` no apps/api para verificação de JWT via JWKS
- `svix` para verificação de assinatura de webhooks
- Webhook `/api/webhooks/clerk/route.ts` sincronizava User/Org/Membership com o Postgres
- `ClerkProvider` no root layout com `localization={ptBR}`
- `clerkMiddleware()` no middleware Next.js
- `ClerkGuard` + `ClerkStrategy` no NestJS

**Razão da remoção:** Eliminar dependência externa de auth provider para
desenvolvimento solo e reduzir surface de ataque. Plan 1 de 5 da estratégia
Auth In-House — ver CONTEXT.md da Phase 02.1 para detalhes.
