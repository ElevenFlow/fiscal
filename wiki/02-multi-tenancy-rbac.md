# 02 — Multi-tenancy & RBAC

## Visão geral

Isolamento entre tenants (empresas) é **defesa em profundidade em 3 camadas**:

1. **Aplicação** — todas as queries Prisma filtram por `tenant_id` explicitamente.
2. **Tenant context (AsyncLocalStorage)** — middleware injeta `{ tenantId, userId, role }` em cada request.
3. **Postgres RLS** — policies recusam linhas de outros tenants mesmo se a query "esquecer" o filtro.

Vazamento cross-tenant = **incidente crítico** (legal, comercial, reputacional). RLS é a última linha — não confie só nele, mas garanta que ele existe.

## Status atual

| Componente | Status |
|-----------|--------|
| Modelos Prisma com `tenant_id` (UUID) | Complete |
| Índice composto `(tenant_id, created_at DESC)` | Complete |
| Roles `app_admin` (BYPASSRLS) e `app_user` (NOBYPASSRLS) | Complete |
| Tenant context middleware (AsyncLocalStorage) | Complete |
| `RolesGuard` + `@Roles()` decorator | Complete |
| Hierarquia de 6 papéis (3 escopos) | Complete |
| `withTenantContext({ role: 'platform_admin' })` para bypasses legítimos | Complete |
| **Policies RLS escritas em SQL raw** | **Planejado (Fase 02)** |
| Contract tests cross-tenant (CI) | Planejado |

## Hierarquia de escopos e papéis

```
ScopeType        Roles
────────────     ─────────────────────────────────────────────
platform         admin
contabilidade    contabilidade_owner | contabilidade_operador
empresa          empresa_owner | empresa_operador | empresa_leitura
```

### Capacidades por papel

| Papel | Lê tudo da plataforma | Lê todas empresas da contab. | Edita empresa | Emite NF | Apenas leitura |
|-------|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✓ | ✓ | ✓ | ✓ | — |
| `contabilidade_owner` | — | ✓ | ✓ | ✓ | — |
| `contabilidade_operador` | — | ✓ | — | ✓ | — |
| `empresa_owner` | — | — (só dele) | ✓ | ✓ | — |
| `empresa_operador` | — | — (só dele) | — | ✓ | — |
| `empresa_leitura` | — | — (só dele) | — | — | ✓ |

## Arquivos envolvidos

### Backend (apps/api)
- `src/modules/tenants/tenants.module.ts`
- `src/modules/tenants/tenant-context.middleware.ts` — extrai contexto da sessão e popula AsyncLocalStorage
- `src/modules/tenants/tenant-context.guard.ts` — exige presença de tenant em rotas restritas
- `src/modules/tenants/tenant-context.ts` — `runWithContext()`, `getTenantContext()`, `withTenantContext()`
- `src/modules/rbac/rbac.module.ts`
- `src/modules/rbac/roles.guard.ts` — checa `@Roles()` consultando `user_memberships`
- `src/modules/rbac/roles.decorator.ts`

### Shared
- `packages/shared/src/tenant.ts` — `ScopeTypeSchema`, `RoleSchema`, `TenantContextSchema`

### Database
- `apps/api/prisma/schema.prisma` — modelos `User`, `UserMembership`, `Contabilidade`, `Empresa`, `ContabilidadeEmpresa`
- `infra/postgres/init.sql` — bootstrap das roles `app_admin` e `app_user`
- Migration RLS (planejada) — policies `FORCE` em todas as tabelas de domínio

## Modelo de dados

```prisma
model UserMembership {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid @map("user_id")
  scopeType String   @map("scope_type")        // 'platform' | 'contabilidade' | 'empresa'
  scopeId   String?  @db.Uuid @map("scope_id") // null para platform
  role      String                             // ver enum acima
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([scopeType, scopeId])
}
```

Veja schema completo em [99-banco-de-dados.md](99-banco-de-dados.md).

## Padrão de uso

### 1. Anotar controller com `@Roles(...)`

```ts
@Controller('empresas')
@UseGuards(ClerkGuard, RolesGuard)
export class EmpresasController {
  @Get()
  @Roles('admin', 'contabilidade_owner', 'contabilidade_operador')
  list() { /* ... */ }

  @Post()
  @Roles('admin', 'contabilidade_owner')
  create() { /* ... */ }
}
```

### 2. Acessar tenant no service

```ts
import { getTenantContext } from '../tenants/tenant-context';

@Injectable()
export class EmpresasService {
  list() {
    const { contabilidadeId } = getTenantContext();
    return this.prisma.empresa.findMany({
      where: {
        contabilidades: { some: { contabilidadeId, ativo: true } },
      },
    });
  }
}
```

### 3. Bypass legítimo (admin operations)

Usado quando precisamos cruzar tenants legitimamente — ex.: auth lookup, LGPD export do próprio usuário.

```ts
import { withTenantContext } from '../tenants/tenant-context';

const memberships = await withTenantContext(
  { role: 'platform_admin', userId },
  () => prisma.userMembership.findMany({ where: { userId } })
);
```

> ⚠️ **Auditar todo uso de `withTenantContext({ role: 'platform_admin' })`.** O `AuditInterceptor` deve sempre logar.

## Política RLS (planejada)

Padrão para toda tabela de domínio:

```sql
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas FORCE ROW LEVEL SECURITY;  -- mesmo OWNER respeita

CREATE POLICY tenant_isolation_select ON empresas
  FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_modify ON empresas
  FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

E no middleware, antes de cada query:

```ts
await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
```

> O `app_admin` (utilizado em migrations e jobs cross-tenant) tem `BYPASSRLS`. Nunca abrir conexão runtime com `app_admin`.

## Decisões e ressalvas

- **`tenant_id == empresa.id`** redundância proposital. Permite policies RLS uniformes em todas as tabelas (sempre `tenant_id`, nunca `empresa_id`/`fornecedor_id`).
- **Índice composto** `(tenant_id, created_at DESC)` — sem ele, RLS vira *full table scan*.
- **Particionar** `audit_log` e `nota_fiscal` por `tenant_id + ano` (Fase 02 — `pg_partman`).
- **`SET LOCAL`** (não `SET`) — escopo da transação. Connection pooler (PgBouncer transaction mode) é compatível.
- **Mudanças de role no Clerk** chegam via webhook → atualizam `user_memberships`. Cache invalidation manual se houver Redis.

## Tests obrigatórios

Em `apps/api/tests/`:
- `roles-guard-rbac.spec.ts` — usuário com role X não pode acessar endpoint que exige role Y.
- `rls-regression.spec.ts` — usuário da contabilidade A NÃO consegue ler empresa da contabilidade B (mesmo com bug que esqueça `where`).
- Contract test no CI — rodar query sem filtro e validar que retorna ZERO linhas de outros tenants.

## Próximos passos

- [ ] Migration SQL com policies RLS para todas as tabelas de domínio
- [ ] `pg_partman` em `audit_log` e (futuro) `nota_fiscal`
- [ ] Testes de regressão cross-tenant rodando em todo PR
- [ ] Cache de membership (Redis, TTL 60s) — reduzir round-trip ao DB em todo request
- [ ] Métrica em Sentry: contagem de tentativas RLS-block (`row level security violates`)
