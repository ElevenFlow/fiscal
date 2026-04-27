# 03 — Auditoria (audit log)

## Visão geral

Trilha de auditoria **append-only**, particionada mensalmente, com retenção mínima de **5 anos** (alinhada com prazo decadencial fiscal — CTN 173/174). Captura toda ação relevante: emissão, cancelamento, mudança de cadastro, login admin, exportação LGPD etc.

## Status atual

| Componente | Status |
|-----------|--------|
| Modelo Prisma `AuditLog` (PK composta `id + created_at`) | Complete |
| Tabela criada como `PARTITION BY RANGE (created_at)` em SQL raw | Complete |
| `AuditService.log(...)` | Complete |
| `AuditInterceptor` (global) escutando `@Auditable()` | Complete |
| Trigger `BEFORE UPDATE/DELETE` que faz `RAISE EXCEPTION` | Planejado (Fase 02) |
| Snapshot diário para S3 Object Lock (compliance mode 5 anos) | Planejado |
| Hash chain (`prev_hash + row_hash`) tamper detection | Planejado |
| Particionamento mensal automatizado (Lambda + `pg_partman`) | Planejado |
| Visualizador na UI | Scaffolded — ver [13-auditoria-viewer.md](13-auditoria-viewer.md) |

## Arquivos envolvidos

### Backend (apps/api)
- `src/modules/audit/audit.module.ts`
- `src/modules/audit/audit.service.ts` — `log({ action, resourceType, resourceId, diff, result })`
- `src/modules/audit/audit.interceptor.ts` — global, escuta `@Auditable()` no handler
- `src/modules/audit/auditable.decorator.ts`

### Database
- `apps/api/prisma/schema.prisma` — model `AuditLog`
- Migration SQL — tabela como `PARTITION BY RANGE (created_at)` + partições iniciais

### Docs
- `docs/OPS_README.md` — runbook de criação de partições mensais

## Modelo de dados

```prisma
model AuditLog {
  id           String   @default(uuid()) @db.Uuid
  tenantId     String?  @db.Uuid @map("tenant_id")
  userId       String?  @db.Uuid @map("user_id")
  action       String                                   // ex.: 'empresa.create', 'nota.emit', 'lgpd.export'
  resourceType String?  @map("resource_type")           // ex.: 'empresa', 'nota_fiscal'
  resourceId   String?  @map("resource_id")
  diff         Json?                                    // antes/depois, payload, etc.
  ip           String?
  userAgent    String?  @map("user_agent")
  result       String                                   // 'success' | 'denied' | 'error'
  createdAt    DateTime @default(now()) @db.Timestamptz(6)

  @@id([id, createdAt])
  @@index([tenantId, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@map("audit_log")
}
```

> **PK composta** (`id + createdAt`) é exigida pelo Postgres em tabelas particionadas — a chave de partição (`createdAt`) precisa fazer parte da PK.

## Como auditar uma ação

### 1. Anotar o handler

```ts
@Post()
@Roles('admin', 'contabilidade_owner')
@Auditable({ action: 'empresa.create', resourceType: 'empresa' })
async create(@Body() dto: CreateEmpresaDto) {
  return this.empresasService.create(dto);
}
```

### 2. Logar manualmente quando o interceptor não cabe

```ts
constructor(private readonly audit: AuditService) {}

async cancelarNota(id: string, justificativa: string) {
  await this.notas.cancelar(id, justificativa);
  await this.audit.log({
    action: 'nota.cancel',
    resourceType: 'nota_fiscal',
    resourceId: id,
    diff: { justificativa },
    result: 'success',
  });
}
```

### 3. Logar falha (recurso negado, validação)

```ts
catch (err) {
  await this.audit.log({
    action: 'nota.emit',
    resourceType: 'nota_fiscal',
    resourceId: dto.uuid,
    diff: { erro: err.message },
    result: 'error',
  });
  throw err;
}
```

## Convenções de naming

| Convenção | Padrão | Exemplos |
|-----------|--------|----------|
| `action` | `{recurso}.{verbo}` | `empresa.create`, `nota.emit`, `nota.cancel`, `cert.upload`, `auth.login`, `lgpd.export` |
| `resourceType` | snake_case singular | `empresa`, `nota_fiscal`, `cert_a1`, `user_membership` |
| `resourceId` | UUID ou identificador externo | `uuid` ou `chave_acesso` (NF-e) |
| `result` | enum | `success`, `denied`, `error` |
| `diff` | JSON livre | sempre incluir `before` + `after` em updates; nunca `pfxBuffer`/`pfxPassword` |

## Particionamento

Tabela criada em SQL raw:
```sql
CREATE TABLE audit_log (...) PARTITION BY RANGE (created_at);

CREATE TABLE audit_log_2026_04 PARTITION OF audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

Cron mensal (planejado, Lambda):
- Cria partição do mês seguinte (`audit_log_2026_05`).
- Após 5 anos: detacha partição antiga e arquiva no S3 (Object Lock compliance).

## Imutabilidade

Camada 1 — **policy de role:**
```sql
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
GRANT INSERT, SELECT ON audit_log TO app_user;
```

Camada 2 — **trigger** (planejada):
```sql
CREATE OR REPLACE FUNCTION audit_log_no_modify()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_no_modify
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_no_modify();
```

Camada 3 — **snapshot S3** (planejado):
- Cron diário exporta partição do dia anterior para `s3://nexofiscal-audit-archive/`.
- Bucket com **Object Lock COMPLIANCE 5 anos** — nem o root AWS apaga.

Camada 4 — **hash chain** (planejado, opcional):
- Cada linha tem `prev_hash` (do registro anterior do mesmo tenant) + `row_hash`.
- Detecta tampering pós-escrita.

## Bibliotecas

| Pacote | Versão | Papel |
|--------|--------|-------|
| `@prisma/client` | 6.x | Inserts |
| `pg_partman` (Postgres) | latest | Particionamento (planejado) |
| `@aws-sdk/client-s3` | 3.x | Snapshot Object Lock |

## Padrões e ressalvas

- **`tenantId` pode ser `null`** apenas em ações `platform` (admin global, login, webhook do Clerk). Para tudo do domínio é obrigatório.
- **`diff` JSONB** — bom para auditoria, ruim para *querying* genérico. Quando filtrar muito por um campo, promova-o para coluna nomeada.
- **Não inclua dados regulados sem necessidade** — Pino redact ajuda nos logs, mas o `diff` é livre. Filtrar PII no service antes de gravar.
- **Volume cresce rápido** — partição mensal + index `(tenant_id, created_at DESC)` resolve até ~10M linhas/mês por tenant. Acima disso, particionar por tenant.
- **Idempotência:** `AuditInterceptor` só logra UMA vez por request, mesmo com retry — usa `Reflector` no handler.

## Próximos passos

- [ ] Trigger `BEFORE UPDATE/DELETE` (migration)
- [ ] Cron Lambda — criar partição mês+1 todo dia 25
- [ ] Snapshot diário → S3 Object Lock
- [ ] Hash chain opt-in para tenants Enterprise
- [ ] Visualizador UI ([13-auditoria-viewer.md](13-auditoria-viewer.md))
- [ ] Export CSV (com filtro por data/ação/recurso)
- [ ] Alertas — contagem de `result='denied'` > N em 5 min → Slack/Sentry
