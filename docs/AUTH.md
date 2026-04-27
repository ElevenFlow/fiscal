# Autenticação — Nexo Fiscal (in-house JWT + argon2)

**Implementado em:** Phase 2.1 (Plans 02.1-01 a 02.1-04)
**Substitui:** Clerk Organizations (removido em Phase 2.1)

---

## Visão geral

Autenticação própria baseada em JWT HS256 + argon2id, sem dependência de
provedor externo:

- **Hashing de senha:** argon2id via `@node-rs/argon2` (parâmetros NIST SP 800-63B)
- **Tokens:** JWT HS256 assinado com `AUTH_JWT_SECRET`; lib `jose`
- **Sessões:** cookie HttpOnly `nf_access` (15 min) + `nf_refresh` (7 dias)
- **Rotação:** refresh token single-use com hash sha256 no banco

---

## Variáveis de ambiente obrigatórias

### apps/api (.env.local)

```env
# JWT secret — mínimo 32 caracteres
# Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ou:   openssl rand -hex 32
AUTH_JWT_SECRET=<gere-um-secret-real>

# Development only: true permite x-user-id/x-role headers sem JWT real
ALLOW_HEADER_AUTH=false
```

### apps/web (.env.local)

```env
# Mesmo valor que em apps/api — usado pelo middleware para verificar nf_access
AUTH_JWT_SECRET=<mesmo-valor-do-apps-api>
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**IMPORTANTE:** `AUTH_JWT_SECRET` deve ser idêntico em ambos os serviços.
Em produção, usar AWS Secrets Manager, Parameter Store, ou similar.
Nunca commitar o valor real — usar apenas placeholder no `.env.example`.

---

## Como gerar AUTH_JWT_SECRET

```bash
# Opção 1 — Node.js (sem dependências extras)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opção 2 — openssl
openssl rand -hex 32
```

---

## Fluxo de autenticação

```
[Browser] POST /api/auth/signin (email + senha)
    → [Route Handler apps/web] proxy para apps/api
    → [AuthController] PasswordService.verify(argon2id) → ok
    → SessionsService.create() → novo refresh token (32 bytes hex)
    → JwtService.sign() → access token JWT HS256 (15 min)
    → Set-Cookie: nf_access (HttpOnly, 15min) + nf_refresh (HttpOnly, 7d)

[Browser] GET /app/dashboard (request autenticada)
    → [middleware.ts] jwtVerify(nf_access, AUTH_JWT_SECRET)
        → ok: next()
        → expirado + nf_refresh válido: refresh automático → next()
        → sem cookie ou inválido: redirect /entrar?next=...
    → [Server Component] requireSession() → ok
    → [fetchApi] Authorization: Bearer <nf_access> → apps/api
    → [AuthGuard] jwtVerify → popula req.auth → handler
```

---

## Cookies

| Cookie | TTL | Path | Flags |
|--------|-----|------|-------|
| `nf_access` | 15 minutos | `/` | HttpOnly, SameSite=Lax, Secure (prod) |
| `nf_refresh` | 7 dias | `/api/auth/refresh` | HttpOnly, SameSite=Lax, Secure (prod) |

---

## Endpoints (apps/api)

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/signup` | Público | Criar conta. Body: `{ email, password (min 12), fullName }` |
| POST | `/api/auth/signin` | Público | Entrar. Body: `{ email, password }` |
| POST | `/api/auth/signout` | Autenticado | Sair. Revoga session atual. |
| POST | `/api/auth/refresh` | Público (cookie) | Rotaciona refresh token. Cookie: `nf_refresh` |
| GET | `/api/auth/me` | Autenticado | Retorna usuário atual + memberships |

---

## Password hashing

- **Algoritmo:** argon2id via `@node-rs/argon2`
- **Parâmetros NIST SP 800-63B:** memoryCost=65536 (64 MB), timeCost=3, parallelism=4, outputLen=32
- **Storage:** coluna `users.password_hash VARCHAR(128)`
- **Verify:** constant-time via `argon2.verify()`

---

## Refresh token rotation

1. `POST /api/auth/refresh` recebe cookie `nf_refresh`
2. Verifica no DB: hash sha256 do token, `revokedAt IS NULL`, `expiresAt > now()`
3. Revoga a session antiga (seta `revokedAt = now()`)
4. Cria nova session com novo refresh token (32 bytes hex, novo hash sha256)
5. Emite novo access token JWT (15 min)

Token comprometido detectado por reuso após rotação → `UnauthorizedException`
(o token anterior não existe mais como ativo no DB).

---

## 1º admin — seed

```bash
pnpm --filter @nexo/api db:seed
```

Cria `admin@nexofiscal.local` com senha `nexo2026` (argon2id) e membership
`{ scopeType: 'platform', role: 'admin' }` se nenhum admin platform existir.

Para staging/produção, prefira o seed seguro e não destrutivo:

```bash
pnpm --filter @nexo/api db:seed:admin
```

Opcionalmente configure `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` antes de rodar.

**Trocar a senha imediatamente após o primeiro login** em `/configuracoes/seguranca`.

---

## Roadmap — Phase 7.1 (Plans 2-5 da Auth In-House)

| Plan | Funcionalidade |
|------|---------------|
| 7.1-02 | Email verification obrigatória (Resend/SES) + reset de senha por email |
| 7.1-03 | Rate limiting de login (Redis sliding window) + CSRF tokens + account enumeration prevention |
| 7.1-04 | Convites de Contabilidade/Empresa via email + UI gerenciar membros |
| 7.1-05 | MFA TOTP + recovery codes + admin tools (lock/unlock, force reset) + LGPD export/delete |

**Atenção:** Phase 2.1 sozinha NÃO está pronta para produção com clientes reais.
Phase 7.1 é bloqueadora antes do primeiro cliente.

---

## Troubleshooting

| Sintoma | Causa provável | Fix |
|---------|----------------|-----|
| `AUTH_JWT_SECRET deve ter pelo menos 32 caracteres` no boot | Secret ausente ou curto demais | Setar `AUTH_JWT_SECRET` no `.env.local` com 32+ chars |
| Middleware redireciona para `/entrar` em loop | Cookie `nf_access` expirado e `nf_refresh` ausente/inválido | Fazer signin novamente; verificar que `AUTH_JWT_SECRET` é igual em api e web |
| `pnpm --filter @nexo/api typecheck` falha em seed.ts | Campo `fullName` não existe no modelo User | User model tem apenas `email`, `passwordHash`, `emailVerifiedAt`, `passwordChangedAt` |
| Build apps/api falha: `Cannot find module '@clerk/backend'` | Ref ao pacote removido sobrou no código | `grep -r "@clerk/" apps/api/src` e remover a importação |
| `bash scripts/check-no-clerk.sh` retorna exit 1 | Referência @clerk/ ainda existe em *.ts/*.tsx/*.json | Ver saída do script para o arquivo/linha específica |
