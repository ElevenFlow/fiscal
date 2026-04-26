---
phase: 02-cadastros-certificado-a1-s-ries
plan: 01
subsystem: database-rls-cadastros-cert-serie
tags: [prisma, postgres, rls, multi-tenant, cadastros, certificado-a1, serie-fiscal, lookup, partitioning]
dependency-graph:
  requires:
    - 01-04 (Prisma + RLS + audit_log + withTenantContext)
    - 01-05 (NestJS + PrismaService + tenantStore)
    - 01-02 (Postgres roles app_user/app_admin)
  provides:
    - prisma-models-cadastros (Cliente, Fornecedor, Produto, Servico)
    - prisma-models-cert (CertificadoDigital, AlertaCertificado)
    - prisma-models-serie (SerieFiscal)
    - prisma-models-cache (CnpjCache, CepCache)
    - prisma-models-lookup (NCM, CEST, CFOP, LC116)
    - rls-policies-phase2 (7 tabelas tenant-scoped com FORCE RLS)
    - cadastros-rls-regression-suite (18 cenários)
    - partial-unique-cert-active (1 cert ativo por empresa)
    - audit_log-partitions-2026-07-to-12
  affects:
    - 02-02 (NestJS CRUD modules — usa modelos Prisma)
    - 02-04 (pipeline cert A1 — usa CertificadoDigital + encryptedDek)
    - 02-05 (cron alertas — usa AlertaCertificado)
    - 02-06 (séries fiscais — usa SerieFiscal numeração)
    - 02-07 (web integration — substitui mocks)
    - 02-08 (worker NCM/CEST/CFOP/LC116 — popula lookups via app_admin)
tech-stack:
  added:
    - "extension pg_trgm (Postgres) — full-text autocomplete em catálogos"
  patterns:
    - "Modelos tenant-scoped relacionam com Empresa via @relation(fields: [tenantId], references: [tenantId]) aproveitando o UNIQUE em Empresa.tenantId"
    - "Índice parcial UNIQUE WHERE ativo=true para invariantes de negócio (1 cert ativo)"
    - "Migration 5: REVOKE explícito de write em catálogos lookup para neutralizar ALTER DEFAULT PRIVILEGES de init.sql"
key-files:
  created:
    - apps/api/prisma/migrations/20260425000100_cadastros_certificado_serie/migration.sql
    - apps/api/prisma/migrations/20260425000200_cadastros_rls_policies/migration.sql
    - apps/api/prisma/migrations/20260425000300_lookup_tabelas_fiscais/migration.sql
    - apps/api/prisma/migrations/20260425000400_audit_log_partition_2026_07_to_12/migration.sql
    - apps/api/prisma/migrations/20260425000500_lookup_revoke_app_user_writes/migration.sql
    - apps/api/tests/cadastros-rls-regression.test.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/prisma/seed.ts
    - infra/postgres/init.sql
    - apps/api/prisma/migrations/migration_lock.toml
decisions:
  - "Relações Cliente/Fornecedor/Produto/Servico/Cert/Serie → Empresa via tenant_id (UNIQUE em Empresa) — não introduz coluna empresaId redundante"
  - "Índice parcial UNIQUE certificados_digitais_one_active_per_tenant é SUFICIENTE para invariante 1-cert-ativo, sem SELECT FOR UPDATE no app code (T-02-01-06)"
  - "pg_trgm é instalada via init.sql (superuser), não via migration — alinha com pattern de DBs gerenciados (RDS) onde app_admin não tem CREATE EXTENSION"
  - "Migration 500 corrige o lookup que ALTER DEFAULT PRIVILEGES de init.sql concedia DML completo a app_user em ncm/cest/cfop/lc116 — agora app_user é estritamente read-only"
  - "Empresa estendida (não-breaking) com nomeFantasia, ie, im, cnae, endereco JSON, contatos JSON, ativo — Phase 1 não tinha esses campos"
metrics:
  duration: ~25min
  completed-date: 2026-04-25
  tasks: 3
  files-created: 6
  files-modified: 4
  test-scenarios: 18
  total-tests-passing: 44
---

# Phase 02 Plan 01: Cadastros + Certificado A1 + Séries — Schema + RLS + Suite Anti-Leak Summary

**One-liner:** Estende o schema multi-tenant da Phase 1 com 13 novos modelos (4 cadastros, 2 cert, 1 série, 2 cache, 4 lookup) + RLS FORCE em 7 tabelas tenant-scoped + suite de regressão de 18 cenários (44/44 testes passando) + correção de 2 bugs de privilégio descobertos em runtime.

## What Was Built

### Task 1: Schema Prisma estendido (commit `8424bd1`)

13 modelos novos em `apps/api/prisma/schema.prisma`:

**Cadastros tenant-scoped** (4 modelos com `@@unique([tenantId, X])` + `@@index([tenantId, createdAt(sort: Desc)])`):
- `Cliente` — PF/PJ com endereco JSON, `@@unique([tenantId, cpfCnpj])` (CAD-09)
- `Fornecedor` — semelhante a Cliente, com `condicoesPadrao` JSON
- `Produto` — SKU + NCM + CEST + CFOP + 4 alíquotas + estoque mín/máx, `@@unique([tenantId, codigo])`
- `Servico` — código LC116/2003 + alíquota ISS + 5 retenções, `@@unique([tenantId, codigoInterno])`

**Certificado A1 + alertas** (2 modelos):
- `CertificadoDigital` — `encryptedDek Bytes` (DEK cifrada por CMK KMS), `s3Key`, `cn`, `cnpjCertificado`, `fingerprint VARCHAR(64)`, `notBefore`/`notAfter Timestamptz(6)`
- `AlertaCertificado` — tier (`D-60..D-0`), severity, `@@unique([certificadoId, tier])` para idempotência do cron

**Séries fiscais** (1 modelo):
- `SerieFiscal` — `modelo` (`NFE_55`/`NFSE`), `serie Int`, `proximoNumero BigInt`, `ambiente` (`HOMOLOGACAO`/`PRODUCAO`), `@@unique([empresaId, modelo, serie])`

**Caches** (2 modelos sem `tenantId` — chave global compartilhada):
- `CnpjCache` (BrasilAPI) + `CepCache` (ViaCEP) com `expiresAt Timestamptz(6)` indexado

**Lookup global** (4 modelos sem `tenantId`):
- `NCM`, `CEST`, `CFOP`, `LC116` — códigos curados por backoffice/worker mensal

**Empresa estendida** (não-breaking):
- Adiciona `nomeFantasia`, `ie`, `im`, `cnae VarChar(10)`, `endereco Json?`, `contatos Json?`, `ativo Boolean` — todos opcionais

### Task 2: 4 migrations SQL aplicadas (commit `c7b86f1`)

**Migration 100 (`20260425000100_cadastros_certificado_serie`):**
- DDL CREATE TABLE para todas 9 tenant-scoped + 4 lookup + 2 cache
- ALTER TABLE empresas adicionando 7 colunas opcionais
- GRANTs SELECT/INSERT/UPDATE/DELETE para `app_user` em 9 tabelas tenant-scoped
- Índice parcial UNIQUE `certificados_digitais_one_active_per_tenant ON (tenant_id) WHERE ativo = true` — força no banco (T-02-01-06)

**Migration 200 (`20260425000200_cadastros_rls_policies`):**
- ENABLE + FORCE ROW LEVEL SECURITY em 7 tabelas tenant-scoped
- Policy `*_tenant_isolation FOR ALL TO app_user` com:
  - USING: `current_setting('app.role')='platform_admin' OR tenant_id = NULLIF(current_setting('app.current_tenant'),'')::uuid`
  - WITH CHECK: idem (rejeita INSERT cross-tenant — T-02-01-02)
- `cnpj_cache`/`cep_cache` permanecem sem RLS (T-02-01-03 — catálogo público)

**Migration 300 (`20260425000300_lookup_tabelas_fiscais`):**
- GRANT SELECT em ncm/cest/cfop/lc116 para `app_user`
- GRANT full em mesmas tabelas para `app_admin`
- `pg_trgm` GIN index para autocomplete fuzzy nas descrições

**Migration 400 (`20260425000400_audit_log_partition_2026_07_to_12`):**
- `SELECT ensure_audit_log_partition('2026-07-01'..'2026-12-01')` — 6 partições novas
- Remove gap entre 2026-06 (Phase 1) e fim do ano (T-02-01-08)

**Verificação runtime:**
- `pg_policies WHERE tablename IN (...) → 7`
- 9 partições de audit_log (2026_04 a 2026_12)
- 4 índices `*_descricao_trgm` ativos
- Índice parcial `certificados_digitais_one_active_per_tenant` confirmado

### Task 3: Suite anti-leak Phase 2 + seed estendido + 5ª migration (commit `9f1f764`)

**`apps/api/tests/cadastros-rls-regression.test.ts`** — 18 cenários:

| Grupo | Cenário | Coverage |
|-------|---------|----------|
| Setup | beforeAll sanity check current_user/is_superuser | — |
| Setup | beforeEach `RESET ALL` | — |
| clientes | sem withTenantContext → 0 rows | CAD-04 |
| clientes | tenant A vê apenas seus | CAD-04 |
| clientes | ID enumeration cross-tenant bloqueado | CAD-04 |
| clientes | INSERT com tenant_id alheio rejeitado pelo WITH CHECK | T-02-01-02 |
| clientes | platform_admin vê todos os tenants | FOUND-07 |
| clientes | duplicidade no mesmo tenant rejeitada | CAD-09 |
| clientes | mesmo CNPJ em tenants distintos PERMITIDO | CAD-09 |
| produtos | tenant A vê apenas seus | CAD-04 |
| produtos | tenant B vê 0 (sem seed em B) | CAD-04 |
| produtos | duplicidade `@@unique([tenantId, codigo])` rejeitada | CAD-09 |
| fornecedores | tenant A vê apenas seus | CAD-04 |
| fornecedores | tenant B vê 0 | CAD-04 |
| servicos | tenant A vê apenas seus | CAD-04 |
| series_fiscais | tenant A vê apenas suas | CAD-04 |
| certificados_digitais | índice parcial bloqueia 2º cert ativo no mesmo tenant | T-02-01-06 / CERT-06 |
| certificados_digitais | cert com `ativo=false` adicional é PERMITIDO (rotação histórica) | CERT-06 |
| lookup | app_user lê NCM/CFOP | T-02-01-05 |
| lookup | app_user NÃO consegue INSERT em NCM | (mitigate via Migration 500) |

**Resultado:** `18/18 passed in 584ms`. Suite completa do `apps/api`: `44/44` em 7.82s.

**`apps/api/prisma/seed.ts`** — Phase 2 fixtures via upsert (idempotente):
- 2 clientes com mesmo CNPJ em A e B (valida duplicidade-por-tenant)
- 1 fornecedor em A
- 1 produto em A (codigo `SKU-001`, NCM `12345678`)
- 1 servico em A (codigoInterno `SVC-001`, codigoMunicipal `17.01`)
- 1 série em A (NFE_55 serie 1 ambiente HOMOLOGACAO)
- Cleanup Phase 2 movido para ANTES de `empresa.deleteMany()` para respeitar FK

**Migration 500 (`20260425000500_lookup_revoke_app_user_writes`):**
- REVOKE INSERT/UPDATE/DELETE de `app_user` em ncm/cest/cfop/lc116
- Corrige privilege gap descoberto em runtime — ver Deviations abaixo

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `app_admin` não tem CREATE EXTENSION privilege**

- **Found during:** Task 2 — primeira execução de `prisma migrate deploy`
- **Issue:** Migration 300 começava com `CREATE EXTENSION IF NOT EXISTS pg_trgm;` — Postgres rejeitou com `42501 permission denied to create extension "pg_trgm"`. `app_admin` (definido no init.sql como `LOGIN PASSWORD ... BYPASSRLS CREATEDB CREATEROLE`) não tem privilégio de criar extensions; isso é o pattern correto para DBs gerenciados (RDS), onde extensions são pré-instaladas como superuser.
- **Fix:**
  - Instalei `pg_trgm` via `docker exec ... psql -U postgres -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'`
  - Adicionei `pg_trgm` à lista de extensions em `infra/postgres/init.sql` (alinha bootstrap futuro)
  - Marquei a migration como rolled-back via `prisma migrate resolve --rolled-back` e re-rodei (Postgres trata `CREATE EXTENSION IF NOT EXISTS` como no-op quando já existe — passou)
- **Files modified:** `infra/postgres/init.sql`
- **Commit:** `c7b86f1`

**2. [Rule 1 — Bug] `app_user` podia INSERT em tabelas lookup mesmo após GRANT SELECT explícito**

- **Found during:** Task 3 — primeira execução do suite (17/18, falha em "app_user NÃO consegue INSERT em NCM")
- **Issue:** `init.sql` declara `ALTER DEFAULT PRIVILEGES FOR ROLE app_admin IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user`. Isso concede DML completo a `app_user` em qualquer tabela criada por `app_admin` ANTES da execução de `GRANT SELECT ON ncm TO app_user`. O GRANT explícito na migration 300 só *adiciona* SELECT (já tinha), nunca *restringe*. Resultado: qualquer usuário autenticado podia poluir os catálogos fiscais (NCM/CEST/CFOP/LC116) — vetor de ataque sério antes de qualquer endpoint de admin existir.
- **Fix:** Criei `20260425000500_lookup_revoke_app_user_writes` com `REVOKE INSERT, UPDATE, DELETE ON ncm/cest/cfop/lc116 FROM app_user`. Esta correção é estrutural (no banco), não apenas em código de aplicação.
- **Threat reclassificada:** T-02-01-05 era `accept`; agora é `mitigate` (write fechado a app_admin via DATABASE_ADMIN_URL — caminho que será usado pelo worker do Plan 02-08).
- **Files created:** `apps/api/prisma/migrations/20260425000500_lookup_revoke_app_user_writes/migration.sql`
- **Commit:** `9f1f764`

**3. [Rule 1 — Bug] FK ordering no seed quebra Phase 1 cleanup**

- **Found during:** Task 3 — primeira execução do `db:seed` após mudanças
- **Issue:** Phase 1 seed faz `prisma.empresa.deleteMany()` para limpar o estado. Após a Phase 2, as tabelas clientes/fornecedores/produtos/servicos/cert/serie referenciam empresas via FK (`tenant_id REFERENCES empresas(tenant_id)`). Sem CASCADE, `empresa.deleteMany` falha com `clientes_tenant_id_fkey` violation.
- **Fix:** Adicionei cleanup das 7 tabelas Phase 2 (em ordem reversa de FK) ANTES de `prisma.empresa.deleteMany()`. Seed agora idempotente — rodei 2x sem erros.
- **Files modified:** `apps/api/prisma/seed.ts`
- **Commit:** `9f1f764`

### Deferred Items

Nenhum item out-of-scope foi adicionado a `deferred-items.md`. Tudo dentro do escopo de Plan 02-01 foi resolvido.

## Authentication Gates

Nenhum auth gate. Postgres local não exige credenciais externas; Docker Desktop foi iniciado pelo executor automaticamente quando estava parado.

## Verification

Conforme `<verification>` block do PLAN:

- [x] `prisma validate` → exit 0 (Task 1 verify)
- [x] `prisma migrate deploy` → exit 0; aplicou 5 migrations limpo (4 do plan + 1 fix de privilégio)
- [x] `prisma generate` → cliente Prisma compila com novos modelos (`Cliente`, `Fornecedor`, `Produto`, `Servico`, `CertificadoDigital`, `AlertaCertificado`, `SerieFiscal`, `CnpjCache`, `CepCache`, `NCM`, `CEST`, `CFOP`, `LC116`)
- [x] `db:seed` → popula fixtures Phase 2 idempotentemente
- [x] `vitest run` (full suite) → `44/44` em 7.82s
- [x] `SELECT COUNT(*) FROM pg_policies WHERE tablename IN (...)` → `7`
- [x] `SELECT relname FROM pg_class WHERE relname LIKE 'audit_log_2026_%'` → 9 partições (`2026_04 .. 2026_12`)

## Threat Model Coverage

Todas as mitigations do `<threat_model>` aplicadas + 1 reforço:

| Threat ID | Mitigação | Validado |
|-----------|-----------|----------|
| T-02-01-01 (I cross-tenant) | RLS FORCE em 7 tabelas + policy NULLIF(GUC,'')::uuid | Suite (12 cenários de visibility) |
| T-02-01-02 (T INSERT cross-tenant) | WITH CHECK em todas policies | Suite ("INSERT com tenant_id de outro tenant") |
| T-02-01-03 (cache compartilhado) | Sem RLS por design — só dados públicos | Por design |
| T-02-01-04 (E privilege escalation) | withTenantContext whitelist + UUID regex (Phase 1) | Phase 1 suite |
| T-02-01-05 (lookup expostas) | **RECLASSIFICADO**: `accept`→`mitigate` via Migration 500 (REVOKE write para app_user) | Suite ("app_user NÃO consegue INSERT em NCM") |
| T-02-01-06 (race cert ativo) | Índice parcial UNIQUE `WHERE ativo=true` | Suite (cert ativo) |
| T-02-01-07 (índice ausente) | `@@index([tenantId, createdAt(sort: Desc)])` em todas tenant-scoped | Schema validado |
| T-02-01-08 (partição ausente 2026-07+) | Migration 400 criou 2026-07..2026-12 | psql verificou 9 partições |
| T-02-01-09 (schema drift) | `prisma generate` no build, `prisma migrate deploy` em CI | DX confirmado |
| T-02-01-10 (encryptedDek expostos) | Defesa principal é a CMK KMS (Plan 02-04) — `accept` no Plan 02-01 | Por design |

## How Downstream Plans Consume

- **Plan 02-02 (NestJS CRUD modules)**: importa `PrismaService` + os 4 modelos de cadastro; cada module aplica `@Roles()` + AuditInterceptor (já em Phase 1).
- **Plan 02-04 (pipeline cert A1)**: cria `CertificadoService` que usa `prisma.certificadoDigital` + `S3Service` (Phase 1) + KMS para envelope encryption do `encryptedDek`. Índice parcial garante invariante 1-cert-ativo automaticamente.
- **Plan 02-05 (cron alertas)**: cria worker BullMQ que varre `prisma.certificadoDigital.findMany({ where: { ativo: true } })` diariamente, calcula tier, faz `prisma.alertaCertificado.upsert` (idempotente via `@@unique([certificadoId, tier])`).
- **Plan 02-06 (séries fiscais)**: usa `prisma.serieFiscal` com `SELECT FOR UPDATE` em transação para incrementar `proximoNumero`.
- **Plan 02-07 (web integration)**: substitui `apps/web/src/lib/mock-data.ts` por queries server-side via `apps/web/src/lib/api-client.ts`.
- **Plan 02-08 (worker NCM/CEST/CFOP/LC116)**: roda com `DATABASE_ADMIN_URL` para inserir em catálogos lookup (REVOKE da migration 500 impede app_user de fazer isso).

## Known Stubs

Nenhum stub. Todos os modelos têm fields completos para uso pelos plans 02-02 a 02-08 sem necessidade de migration adicional.

## Self-Check: PASSED

Verificações executadas:

- [x] `apps/api/prisma/schema.prisma` contém os 13 models novos + `Empresa` estendida (grep tokens OK)
- [x] `apps/api/prisma/migrations/20260425000100_cadastros_certificado_serie/migration.sql` existe e contém `CREATE TABLE "clientes"` + GRANTs + `certificados_digitais_one_active_per_tenant`
- [x] `apps/api/prisma/migrations/20260425000200_cadastros_rls_policies/migration.sql` existe e contém `FORCE ROW LEVEL SECURITY` + `clientes_tenant_isolation` + `produtos_tenant_isolation` + `series_fiscais_tenant_isolation`
- [x] `apps/api/prisma/migrations/20260425000300_lookup_tabelas_fiscais/migration.sql` existe e contém `gin_trgm_ops`
- [x] `apps/api/prisma/migrations/20260425000400_audit_log_partition_2026_07_to_12/migration.sql` existe e contém `ensure_audit_log_partition('2026-12-01'`
- [x] `apps/api/prisma/migrations/20260425000500_lookup_revoke_app_user_writes/migration.sql` existe (Rule 1 fix)
- [x] `apps/api/tests/cadastros-rls-regression.test.ts` existe com 18 cenários
- [x] `apps/api/prisma/seed.ts` contém `Phase 2 fixtures` + `prisma.cliente.upsert`
- [x] Commits existem: `8424bd1` (schema), `c7b86f1` (4 migrations), `9f1f764` (test+seed+fix)
- [x] Postgres runtime: 7 RLS policies + 9 audit_log partitions + 4 trgm indexes + 1 índice parcial cert ativo
- [x] `vitest run` → 44/44 (Phase 1 13/13 + Phase 2 cadastros 18/18 + outros 13/13)
