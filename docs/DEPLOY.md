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
pnpm --filter @nexo/api db:seed      # 1ª vez: cria admin + lookups
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

## Pendências de hardening pré-cliente

1. Trocar senhas hardcoded `app_admin_dev_pass` / `app_user_dev_pass` por aleatórias antes de produção real (estão visíveis no `infra/postgres/init.sql` committado).
2. Aplicar Plans 2-5 da Auth In-House (Phase 7.1): email verification + reset por email + rate limiting + CSRF + MFA.
3. Migrar apps/api para always-on (ver "Migração futura" acima).
4. Provisionar Sentry + OpenTelemetry com DSN/endpoint reais.
5. AWS S3 bucket Object Lock real para certificados + XMLs (atualmente em-memória).
