# Deploy — Nexo Fiscal

## Topologia (staging atual)

```
┌─────────────────────┐         ┌─────────────────────┐
│  Vercel Project A   │  HTTP   │  Vercel Project B   │
│  apps/web           │ ──────> │  apps/api           │
│  (Next.js 16)       │         │  (NestJS+Fastify    │
│                     │         │   serverless wrap)  │
└─────────────────────┘         └─────────────────────┘
                                        │
                                        ▼
                                ┌─────────────────────┐
                                │  Neon Postgres      │
                                │  (us-east-1)        │
                                └─────────────────────┘
```

⚠ **Provisório**. Vercel serverless tem limitações com NestJS:
- BullMQ workers (cert-expiration cron, lookup-sync cron) **não rodam**
- Cold start ~1-3s
- `maxDuration` 60s (Pro) ou 10s (Hobby) — não comporta emissão NFe da Phase 3
- **Antes de Phase 3**, migrar `apps/api` para Fly.io ou Render (always-on Docker)

## Setup Vercel — Project A (apps/web)

Já está configurado. `vercel.json` na raiz:

```json
{
  "buildCommand": "pnpm turbo run build --filter=@nexo/web",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

### Env vars necessárias (Production)
- `AUTH_JWT_SECRET` — mesmo valor que apps/api
- `NEXT_PUBLIC_API_URL` — URL do Project B (ex: `https://nexo-fiscal-api.vercel.app`)
- `NODE_ENV=production`

## Setup Vercel — Project B (apps/api) — NOVO

### 1. Criar segundo projeto Vercel

No Vercel Dashboard → **Add New… → Project**:
1. Importa o mesmo repo `ElevenFlow/fiscal`
2. **Project name**: `nexo-fiscal-api` (ou similar)
3. **Root Directory**: `apps/api` ⚠ importante
4. **Framework Preset**: `Other`
5. **Build Command**: deixa vazio (`vercel.json` controla)
6. **Output Directory**: deixa vazio
7. Antes de fazer "Deploy", configura env vars (passo 2)

### 2. Env vars (Production)

Copia exatamente estas no Vercel Dashboard do Project B:

| Var | Valor | Observação |
|---|---|---|
| `AUTH_JWT_SECRET` | mesmo valor do Project A | gerado via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DATABASE_URL` | string `app_user` no Neon **pooled** | `postgresql://app_user:app_user_dev_pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=10` |
| `DATABASE_ADMIN_URL` | string `app_admin` no Neon **direct** (sem pooler) | usado em build/migrations |
| `APP_URL` | URL do Project A (frontend) | ex: `https://nexo-fiscal-web.vercel.app` — usado para CORS |
| `NODE_ENV` | `production` | |
| `ALLOW_HEADER_AUTH` | `false` | dev-only header bypass — DESLIGAR em prod |
| `STRICT_OBJECT_LOCK` | `false` (staging) / `true` (prod) | aborta boot se S3 cert bucket sem Object Lock |

**Não setar** (intencionalmente vazias em Vercel — não funcionam serverless):
- `REDIS_URL` — BullMQ workers ficam inativos (sem cron de cert-expiration / lookup-sync online)
- `SENTRY_DSN` — pode ativar depois com DSN do Sentry projeto
- `OTEL_EXPORTER_OTLP_ENDPOINT` — idem para tracing

### 3. Deploy

Após env vars configuradas → **Deploy**. Build vai:
1. `pnpm install --frozen-lockfile` (deps do monorepo)
2. `pnpm --filter @nexo/api db:generate` (gera Prisma client)
3. Vercel transpila `apps/api/api/index.ts` (handler serverless)
4. Função fica em `https://<projectB>.vercel.app/api/*`

### 4. Migrações em staging/prod

Vercel build **não** roda migrations automaticamente (intencional — perigo de aplicar destrutivamente). Sequência manual:

```bash
# Local com NEON_SUPER_URL no .env.staging.local
cd <projeto>
node scripts/neon-init.cjs           # primeira vez: roles + extensões
eval $(node -e "
  const fs = require('fs');
  const m = fs.readFileSync('.env.staging.local','utf-8').match(/^NEON_SUPER_URL=(.+)\$/m);
  const u = new URL(m[1].trim());
  console.log('export DATABASE_ADMIN_URL=' + JSON.stringify('postgresql://app_admin:app_admin_dev_pass@' + u.host + u.pathname + u.search));
  console.log('export DATABASE_URL=' + JSON.stringify('postgresql://app_user:app_user_dev_pass@' + u.host + u.pathname + u.search));
")
pnpm --filter @nexo/api db:migrate   # aplica migrations pendentes
pnpm --filter @nexo/api db:seed      # dev/staging zerado: cria fixtures + admin + lookups
pnpm --filter @nexo/api db:seed:admin # staging/prod: cria somente o 1º admin, sem limpar dados
```

Recomendado adicionar essa sequência ao GitHub Action quando estabilizar.

## Limitações conhecidas (Vercel serverless)

| Funcionalidade | Online no Vercel? | Workaround |
|---|---|---|
| Auth (signup/signin/refresh/me) | ✅ | — |
| CRUDs (clientes/fornecedores/produtos/...) | ✅ | — |
| Cert upload + KMS | ✅ | — |
| Séries fiscais + numeração | ✅ | — |
| BrasilAPI/ViaCEP integrations | ✅ | — |
| Lookup autocomplete | ✅ (dados via seed) | — |
| Cert-expiration cron (D-60..D-0) | ❌ | Phase 7.1 ou migração Fly.io |
| Lookup-sync mensal | ❌ | Tabelas estáticas via seed; refresh manual quando precisar |
| Emissão NFe (Phase 3) | ❌❌ | **Bloqueante** — migrar antes |

## Migração futura (antes de Phase 3)

Phase 3 inclui emissão NFe com BullMQ + retry SEFAZ + state machine longa. Vercel serverless não comporta. Caminhos:

1. **Fly.io** (recomendado) — `Dockerfile` + `fly.toml`. Container always-on, BullMQ funciona. Free tier para staging.
2. **Render** — similar. Free tier menor.
3. **AWS Fargate** — alinha com decisões do CLAUDE.md (sa-east-1). Mais trabalho.

Roadmap: durante Phase 3 planning (`/gsd-plan-phase 3`), incluir plano dedicado de migração `apps/api` para always-on antes da emissão real.

## Health check

Após deploy do Project B:
```bash
curl https://<projectB>.vercel.app/api/health
# Esperado: 200 OK + { status: "ok", db: "connected" }
```

Se 502/timeout: cold start. Tenta de novo em 5s.

## Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| Build falha em "Cannot find module @prisma/client" | Prisma client não gerado | Verifica `db:generate` rodou; checa `apps/api/prisma/schema.prisma` no repo |
| `/api/auth/signin` retorna 502 | Cold start lento | Aceitar; warm-up via Vercel Cron (ping /api/health a cada 5min) |
| `/api/auth/signin` retorna 500 | `AUTH_JWT_SECRET` ausente em env do Project B | Set + redeploy |
| CORS error no browser | `APP_URL` no Project B não bate com URL real do Project A | Atualizar e redeploy |
| `function size > 50MB` | Bundle estourou | `excludeFiles` em vercel.json (excluir tests/, fixtures/, etc) |
| BullMQ tentando conectar Redis em prod | `REDIS_URL` setada por engano | Remove env var no Project B; QueueModule no-op sem ela |

## Render (caminho atualmente recomendado)

Substitui a topologia "Vercel-Project-B" para `apps/api` — Render roda Docker always-on,
o que é necessário para BullMQ, NF-e (Phase 3+) e lookup syncs.

Topologia: **Vercel (`@nexo/web`) + Render (`@nexo/api`) + Neon (Postgres) + Upstash (Redis)**.

### Arquivos do repo

- [`apps/api/Dockerfile`](../apps/api/Dockerfile) — Node 22 + pnpm, multi-stage.
- [`apps/api/scripts/release.sh`](../apps/api/scripts/release.sh) — `prisma migrate deploy` + `node dist/main.js`.
- [`render.yaml`](../render.yaml) — blueprint declarativo lido pelo Render no primeiro deploy.
- [`.dockerignore`](../.dockerignore) — exclui `.planning`, `node_modules`, etc.

### Pré-requisitos

- [ ] Neon: projeto `nexofiscal` criado, extensões `uuid-ossp`, `pgcrypto`, `pg_trgm` habilitadas, `DATABASE_URL` em mãos.
- [ ] Upstash: Redis criado em sa-east-1, `REDIS_URL` em mãos (`rediss://...`).
- [ ] `AUTH_JWT_SECRET` gerado: `openssl rand -hex 32`.

### Passos

1. **Render Dashboard** → **New** → **Blueprint** → conecta o repo. Render lê `render.yaml`
   e propõe criar `nexofiscal-api`. Confirma.
2. No painel do serviço → **Environment** → preenche as vars marcadas `sync: false`:
   - `AUTH_JWT_SECRET` (mesmo valor que vai pra Vercel)
   - `DATABASE_URL` (Neon, role default, `?sslmode=require`)
   - `DATABASE_ADMIN_URL` (igual ao `DATABASE_URL` no setup Neon — ele não tem role separado por default; veja nota abaixo)
   - `REDIS_URL` (Upstash, `rediss://...`)
   - `WEB_ORIGIN` (URL do projeto Vercel, ex: `https://nexofiscal.vercel.app`)
3. Render builda. Logs OK = `prisma migrate deploy` aplica todas as migrations + `Listening on 0.0.0.0:3333`.
4. Health: `https://nexofiscal-api.onrender.com/api/health` retorna 200.
5. **Seed do admin** (uma vez): Render serviço → **Shell** → `npx tsx prisma/seed-admin.ts`
   (variáveis exigidas em [`apps/api/prisma/seed-admin.ts`](../apps/api/prisma/seed-admin.ts)).
6. **Vercel** (projeto `@nexo/web`) → Settings → Environment Variables:
   - `NEXT_PUBLIC_API_URL=https://nexofiscal-api.onrender.com`
   - `AUTH_JWT_SECRET` = mesmo do Render
   - **Redeploy**.

### Nota sobre Neon + RLS

O `init.sql` local cria roles `app_admin` (BYPASSRLS) e `app_user` (NOBYPASSRLS) — **Neon
não permite a flag BYPASSRLS** (privilégio de superuser indisponível em managed Postgres).
Workaround MVP: usar o role default do Neon (que é dono das tabelas e bypassa RLS por
ownership, salvo se a tabela tiver `FORCE ROW LEVEL SECURITY`) tanto em `DATABASE_URL`
quanto em `DATABASE_ADMIN_URL`. Hardening real: criar role separado via SQL e ajustar
políticas; vide `PEND-027`.

### Limitações Free Tier do Render

- Web Service free **dorme após 15 min sem tráfego** (~30s de wake-up). Para crons BullMQ
  rodarem 24/7, upgrade para `starter` (~$7/mês).
- Build pode demorar ~5–7 min na primeira vez (Docker layers do zero).

### Após o backend online

Remover o fallback mock client-side adicionado para destravar a Vercel:
- [`apps/web/src/components/shell/empresa-switcher.tsx`](../apps/web/src/components/shell/empresa-switcher.tsx)
- [`apps/web/src/app/(app)/cadastros/empresas/page.tsx`](../apps/web/src/app/(app)/cadastros/empresas/page.tsx)

Closes `PEND-027`.

## Pendências de hardening pré-cliente

1. Trocar senhas hardcoded `app_admin_dev_pass` / `app_user_dev_pass` por aleatórias antes de produção real (estão visíveis no `infra/postgres/init.sql` committado).
2. Aplicar Plans 2-5 da Auth In-House (Phase 7.1): email verification + reset por email + rate limiting + CSRF + MFA.
3. Migrar apps/api para always-on (ver "Migração futura" acima).
4. Provisionar Sentry + OpenTelemetry com DSN/endpoint reais.
5. AWS S3 bucket Object Lock real para certificados + XMLs (atualmente em-memória).
