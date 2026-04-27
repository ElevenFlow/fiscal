# 00 — Arquitetura geral

Visão estrutural do monorepo Nexo Fiscal: como o código está organizado, como as partes se conversam e quais decisões arquiteturais são *load-bearing* (você precisa entendê-las antes de mexer em qualquer rotina).

---

## Estrutura do monorepo

```
Controles Fiscais/
├── apps/
│   ├── web/                    Next.js 15 (App Router) — frontend + Route Handlers (BFF)
│   └── api/                    NestJS 11 — API fiscal, jobs, integrações
├── packages/
│   ├── shared/                 @nexo/shared — schemas Zod + tipos compartilhados
│   └── ui/                     @nexo/ui — design system (shadcn + Tailwind preset)
├── infra/
│   └── postgres/               docker-compose, init.sql (roles, RLS bootstrap)
├── docs/                       runbooks (Clerk, observability, ops)
├── scripts/                    db-reset.sh / db-reset.ps1
├── prisma/ (em apps/api)       schema.prisma + migrations
├── .planning/                  artefatos GSD por fase (não versionado normalmente)
└── docker-compose.yml          Postgres 16 + Redis 7 + dependências dev
```

**Gerenciador de pacotes:** `pnpm` + workspaces. Build orchestrator: `Turborepo`.

**Lint/format:** `Biome` (10× mais rápido que ESLint+Prettier em 2026).

---

## Camadas

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│  (React 19 + shadcn/ui + cmdk Ctrl+K + TanStack Table)             │
└────────────────────┬───────────────────────────────────────────────┘
                     │  fetch (same-origin, cookie + CSRF futuro)
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  Next.js (apps/web) — App Router                                   │
│  • Páginas (Server Components)                                     │
│  • Route Handlers /api/* (BFF: proxy autenticado p/ NestJS)        │
│  • middleware.ts (Clerk)                                           │
│  • Server Actions (forms fiscais grandes)                          │
└────────────────────┬───────────────────────────────────────────────┘
                     │  HTTPS + Bearer JWT (Clerk)
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  NestJS (apps/api) — Fastify adapter                               │
│  • ClerkGuard → RolesGuard → AuditInterceptor                      │
│  • Tenant context (AsyncLocalStorage)                              │
│  • Módulos: Auth, Tenants, RBAC, Audit, Storage, LGPD, Health,     │
│    Observability                                                   │
└─────────┬───────────────────────┬─────────────────┬────────────────┘
          │                       │                 │
          ▼                       ▼                 ▼
   ┌──────────────┐         ┌──────────────┐   ┌──────────────┐
   │ Postgres 16  │         │ Redis 7      │   │ AWS S3       │
   │ • RLS        │         │ • BullMQ     │   │ • Object Lock│
   │ • partições  │         │ • cache NCM  │   │   (compliance│
   │ • audit_log  │         │              │   │   6 anos)    │
   └──────────────┘         └──────────────┘   └──────────────┘
                                                       │
                                                       ▼
                                             ┌──────────────────┐
                                             │ AWS KMS          │
                                             │ • CMK por tenant │
                                             │ • envelope .pfx  │
                                             └──────────────────┘
```

**Integrações externas:**
- **Clerk** — auth + Organizations
- **Focus NFe / PlugNotas** — gateways de emissão (Fase 2+)
- **Sentry** — error tracking
- **AWS ADOT / SigNoz** — tracing (OTLP)

---

## Decisões arquiteturais *load-bearing*

### 1. Stack TypeScript unificado (web + api + packages)

**Por quê:** schemas Zod **únicos** em `@nexo/shared` consumidos por backend (DTO validation) e frontend (React Hook Form resolver). Evita drift de validação CPF/CNPJ entre camadas.

**Alternativas rejeitadas:** PHP `sped-nfe` (polyglot custa mais), .NET `Zeus/ACBr` (quebra pipeline JS/TS).

### 2. NestJS no backend (não Fastify puro)

**Por quê:** *guards*, *interceptors*, *modules* mapeiam 1:1 com requisitos de multi-tenant + audit + RBAC. Cada preocupação vira um interceptor testável isoladamente.

### 3. Postgres + RLS (Row-Level Security) para isolamento

**Por quê:** padrão de mercado SaaS multi-tenant 2026. RLS é a **última linha de defesa** contra vazamento cross-tenant — se o app esquecer de filtrar por `tenant_id`, o banco recusa.

**Modelo de tenancy:** *shared schema, shared table, RLS-enforced*. Hierarquia:
```
platform (admin global)
  └── contabilidade (Clerk Org)
        └── empresa (tenant_id == empresa.id)
```

Veja detalhes em [02-multi-tenancy-rbac.md](02-multi-tenancy-rbac.md).

### 4. Build vs Buy fiscal — gateway (BaaS) no MVP

**Decisão:** **Focus NFe** como primário, **PlugNotas** como contingência.

Internalizar (com `NFeWizard-io` + `xml-crypto`) é só Fase 2+. Risco #1 em projetos fiscais BR: assinatura XMLDSig com C14N quebrado → rejeição SEFAZ 297. Comprar elimina esse risco no MVP.

Detalhes em [09-emissao.md](09-emissao.md).

### 5. AWS sa-east-1 (São Paulo)

**Por quê:** latência SEFAZ SP/SE 2–8 ms vs 120–160 ms em us-east-1. Conforto LGPD (dados em território nacional).

### 6. App Router (Next.js 15) com Route Handlers como BFF

Páginas = Server Components. Para chamar a API NestJS a partir do browser (com JWT), usamos **Route Handlers em `/api/*` como proxy** — o token nunca toca o cliente. Padrão **Route Handler Proxy** documentado em [99-padroes-desenvolvimento.md](99-padroes-desenvolvimento.md).

### 7. BullMQ (Redis) para jobs assíncronos

Emissão fiscal é I/O-bound + sujeita a contingência SEFAZ → fila com *retry* exponencial é obrigatório. BullMQ é o padrão Node.js 2026.

**Alternativa**: `pg-boss` (sem Redis) — só se quisermos enxugar dependências.

---

## Fluxos críticos (quem chama quem)

### Login → primeiro request autenticado
```
1. Browser → /entrar (Clerk SignIn UI)
2. Clerk emite JWT
3. Browser navega para (app)/page.tsx
   ├── middleware.ts valida sessão Clerk
   └── layout.tsx faz auth() server-side (defesa em profundidade)
4. (Em ações que precisam de dados) Route Handler /api/* anexa Bearer
5. NestJS: ClerkGuard valida JWT → RolesGuard checa @Roles → controller responde
```

### Emissão fiscal (futuro, scaffolded)
```
1. Form NFS-e (Server Action ou Route Handler)
2. NestJS recebe DTO validado (Zod)
3. Enfileira job BullMQ "emit-nfse"
4. Worker pega job → resolve gateway (Focus NFe ou PlugNotas)
5. Gateway responde autorizada/denegada
6. Worker grava XML no S3 (Object Lock 6 anos) + DB
7. Audit log + alerta se denegada
8. Frontend faz polling/SSE pelo status
```

---

## Hierarquia de papéis (3 níveis)

| Escopo | Papéis | Capacidade |
|--------|--------|------------|
| `platform` | `admin` | Bypass RLS, gestão da plataforma |
| `contabilidade` | `contabilidade_owner`, `contabilidade_operador` | Vê todas as empresas vinculadas |
| `empresa` | `empresa_owner`, `empresa_operador`, `empresa_leitura` | Restrito ao tenant da empresa |

Detalhes operacionais em [02-multi-tenancy-rbac.md](02-multi-tenancy-rbac.md).

---

## Onde NÃO colocar lógica nova

- **Não** coloque lógica fiscal em `apps/web/src/app/api/*` — esses Route Handlers são proxies. Lógica fica em NestJS.
- **Não** crie tabela domínio sem `tenant_id` (UUID) — o índice composto `(tenant_id, created_at DESC)` é obrigatório.
- **Não** logue `pfxBuffer`, `pfxPassword`, `cpfCnpj` — Pino redact já mascara, mas não dependa: nunca passe nos logs explicitamente.
- **Não** persista DANFE PDF como fonte de verdade — fonte é o XML autorizado; DANFE é renderizado sob demanda.

---

## Próximos pontos arquiteturais a decidir

- [ ] CSRF tokens nos Route Handlers (hoje só cookies HMAC do gate de login)
- [ ] Schema do `nota_fiscal` (campos comuns NFS-e vs NF-e — modelo único ou tabelas separadas?)
- [ ] Estratégia de cache de tabelas NCM/CFOP/CEST (Redis com TTL longo)
- [ ] Política de *rate limit* (BullMQ ou middleware NestJS via `@fastify/rate-limit`)
