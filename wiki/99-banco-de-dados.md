# 99 — Banco de dados (referência)

Referência consolidada do **Postgres 16** do Nexo Fiscal: schema, roles, RLS, particionamento, extensões e operações.

## Conexão

| Ambiente | Variável | Quem conecta |
|----------|----------|--------------|
| dev local | `DATABASE_URL=postgresql://app_user:...@localhost:5434/nexofiscal_dev` | App runtime |
| dev local | `DATABASE_ADMIN_URL=postgresql://app_admin:...@localhost:5434/nexofiscal_dev` | Migrations, seed |
| prod | RDS Postgres 16 (Multi-AZ) | App via PgBouncer (transaction mode) |

**Porta dev:** `5434` (não 5432 — evita colisão com Postgres do sistema). Definida em `docker-compose.yml`.

## Roles

```sql
-- infra/postgres/init.sql
CREATE ROLE app_admin WITH LOGIN PASSWORD '...' CREATEDB BYPASSRLS;
CREATE ROLE app_user WITH LOGIN PASSWORD '...' NOBYPASSRLS;

GRANT CONNECT ON DATABASE nexofiscal_dev TO app_user, app_admin;
GRANT USAGE ON SCHEMA public TO app_user, app_admin;
```

| Role | BYPASSRLS | Uso |
|------|:---:|-----|
| `app_admin` | ✓ | Migrations, jobs cross-tenant, scripts ops |
| `app_user` | ✗ | Runtime do API/web |

> **Nunca conectar runtime com `app_admin`.** Toda query do request deve passar por RLS.

## Extensões

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- digest, crypt, hash
-- planejado:
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- busca similar (descrição produto)
CREATE EXTENSION IF NOT EXISTS pg_partman;   -- particionamento automático
```

## Schema atual

Localização: `apps/api/prisma/schema.prisma`.

### `users`
```
id           uuid PK (default uuid_generate_v4())
email        text UNIQUE
clerk_user_id text UNIQUE NULLABLE
created_at   timestamp
updated_at   timestamp
```

### `contabilidades`
```
id            uuid PK
nome          text
cnpj          text UNIQUE
clerk_org_id  text UNIQUE NULLABLE
created_at    timestamp
updated_at    timestamp
```

### `empresas`
```
id                uuid PK
tenant_id         uuid UNIQUE  -- == id, redundante de propósito
razao_social      text
cnpj              text UNIQUE
regime_tributario text
created_at        timestamp
updated_at        timestamp

INDEX (tenant_id, created_at DESC)
```

### `contabilidade_empresas`
```
contabilidade_id  uuid (FK → contabilidades)
empresa_id        uuid (FK → empresas)
ativo             boolean DEFAULT true
created_at        timestamp

PK (contabilidade_id, empresa_id)
INDEX (empresa_id)
```

### `user_memberships`
```
id          uuid PK
user_id     uuid (FK → users)
scope_type  text  -- 'platform' | 'contabilidade' | 'empresa'
scope_id    uuid NULLABLE  -- null para platform
role        text  -- ver enum em [02-multi-tenancy-rbac.md]
created_at  timestamp

INDEX (user_id)
INDEX (scope_type, scope_id)
```

### `audit_log` (PARTITIONED)
```
id            uuid (default uuid_generate_v4())
tenant_id     uuid NULLABLE
user_id       uuid NULLABLE
action        text  -- 'empresa.create', 'nota.emit', etc.
resource_type text NULLABLE
resource_id   text NULLABLE
diff          jsonb NULLABLE
ip            text NULLABLE
user_agent    text NULLABLE
result        text  -- 'success' | 'denied' | 'error'
created_at    timestamptz(6)

PK (id, created_at)  -- composta exigida por PARTITION BY
INDEX (tenant_id, created_at DESC)
INDEX (user_id, created_at DESC)
```

Tabela criada como:
```sql
CREATE TABLE audit_log (...) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_04 PARTITION OF audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

## Schema planejado (Fase 02+)

| Modelo | Documento principal |
|--------|---------------------|
| `Cliente` | [07-cadastros.md](07-cadastros.md) |
| `Fornecedor` | [07-cadastros.md](07-cadastros.md) |
| `Produto` | [07-cadastros.md](07-cadastros.md) |
| `Servico` | [07-cadastros.md](07-cadastros.md) |
| `NotaFiscal`, `NotaFiscalEvento` | [08-documentos.md](08-documentos.md) |
| `ImportXml` | [10-importacao-xml.md](10-importacao-xml.md) |
| `EstoqueSaldo`, `EstoqueMovimento` | [11-estoque.md](11-estoque.md) |
| `Alerta` | [12-alertas.md](12-alertas.md) |
| `CertA1`, `SerieFiscal`, `Webhook`, `ApiToken` | [14-configuracoes.md](14-configuracoes.md) |

## Convenções

### Nomenclatura
- **Tabelas:** `snake_case`, plural (`empresas`, `notas_fiscais`).
- **Colunas:** `snake_case` (`tenant_id`, `created_at`).
- **Prisma → DB:** `@@map("...")` para tabela, `@map("...")` para coluna camelCase ↔ snake_case.

### Tipos
- **IDs:** `uuid` (Postgres) gerado pelo banco com `uuid_generate_v4()`. Prisma `@default(uuid())`.
- **Datas/horas:** `timestamptz(6)` para todo timestamp fiscal. **Sempre** com timezone para evitar bugs `BRT vs UTC`.
- **Valores monetários:** `decimal(15, 2)` para reais inteiros, `decimal(15, 4)` para preços unitários (4 casas evita float drift).
- **Strings curtas:** `varchar(N)` quando há tamanho fixo legal (NCM=8, CFOP=4, chave NF-e=44). Caso contrário, `text`.
- **JSON:** `jsonb` (não `json` — sem indexação).

### Índices obrigatórios em tabelas multi-tenant
```sql
CREATE INDEX ON {tabela} (tenant_id, created_at DESC);
```
Sem ele, RLS vira full scan.

### Foreign Keys
- **ON DELETE RESTRICT** (default) para entidades fiscais — não permita deletar empresa com nota emitida.
- **ON DELETE CASCADE** apenas em entidades subordinadas (ex.: `nota_fiscal_evento` cascateia se `nota_fiscal` apagada — o que **não acontece** porque notas são imutáveis).

## RLS (Row-Level Security)

Padrão a ser aplicado a **todas as tabelas de domínio** (Fase 02):

```sql
ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {tabela} FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON {tabela}
  FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

A aplicação seta:
```sql
SET LOCAL app.tenant_id = '<uuid>';
```
em cada transação (compatível com PgBouncer transaction mode).

`app_admin` ignora (BYPASSRLS); usado em jobs cross-tenant e na migração — NUNCA em endpoints HTTP.

## Particionamento

| Tabela | Estratégia | Frequência | Retenção |
|--------|-----------|------------|----------|
| `audit_log` | RANGE por `created_at` | Mensal | 5+ anos |
| `nota_fiscal` (futuro) | LIST por `tenant_id`, RANGE por `dh_emi` | Anual | 5+ anos |
| `estoque_movimento` (futuro) | RANGE por `created_at` | Trimestral | 5 anos |

Automação via `pg_partman` + cron Lambda (cria partição mês+1 todo dia 25).

## Migrations

```bash
# Criar nova migration
pnpm --filter @nexo/api prisma migrate dev --name add_clientes

# Aplicar em prod (RDS)
pnpm --filter @nexo/api prisma migrate deploy

# Reset dev local
pnpm dlx tsx scripts/db-reset.ts
# ou
bash scripts/db-reset.sh   # ./db-reset.ps1 no Windows
```

### Migrations com SQL raw

Para coisas que Prisma não suporta nativamente (RLS policies, particionamento, triggers), criar migration vazia e editar:

```bash
pnpm --filter @nexo/api prisma migrate dev --create-only --name rls_audit_log
# edita o arquivo .sql resultante
pnpm --filter @nexo/api prisma migrate dev
```

## Backups e DR

- **Automated snapshots** (RDS) — diários, retenção 30 dias.
- **PITR** (Point-in-Time Recovery) — qualquer minuto últimos 7 dias.
- **Manual snapshots** — antes de toda migration de produção.
- **Cross-region replica** (planejado) — `sa-east-1` → `us-east-1` (read-only) para DR.

## Operações comuns

### Verificar quem pode bypass RLS
```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname LIKE 'app_%';
```

### Verificar policies em uma tabela
```sql
SELECT * FROM pg_policies WHERE tablename = 'empresas';
```

### Listar partições do audit_log
```sql
SELECT
  inhrelid::regclass AS partition,
  pg_get_expr(relpartbound, oid) AS bounds
FROM pg_class
JOIN pg_inherits ON inhparent = oid
WHERE relname = 'audit_log'
ORDER BY 2;
```

### Espaço em disco por tabela
```sql
SELECT
  relname AS tabela,
  pg_size_pretty(pg_total_relation_size(relid)) AS tamanho
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

## Bibliotecas e tooling

| Pacote | Versão | Papel |
|--------|--------|-------|
| `@prisma/client` | 6.x | ORM runtime |
| `prisma` | 6.x | CLI (migrate, generate) |
| `pg_partman` | latest | Particionamento (Fase 02) |
| `pg_trgm` | (bundled) | Busca similar (Fase 02) |
| `tsx` | latest | Rodar seed.ts |

## Pitfalls comuns

- **Esquecer `tenant_id` no INSERT** → RLS recusa. Erro `new row violates row-level security policy`.
- **`SET` em vez de `SET LOCAL`** → vaza para a próxima query do pool. **Sempre `SET LOCAL`**.
- **Migrations destrutivas em prod** sem backup recente → use `prisma migrate deploy --create-only` em staging primeiro.
- **`json` em vez de `jsonb`** → não indexa, performance ruim.
- **`timestamp` sem TZ** → bugs sutis em horário de verão (a SEFAZ exige `-03:00`).
- **PK sem `created_at` em tabela particionada** → migration falha. Toda PK numa partitioned-by-range table precisa incluir a coluna de partição.
