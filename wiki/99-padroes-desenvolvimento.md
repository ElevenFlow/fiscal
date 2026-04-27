# 99 — Padrões de desenvolvimento

Padrões transversais que se aplicam a múltiplas rotinas. **Leia antes de implementar uma nova feature.**

---

## 1. Tenant Context (AsyncLocalStorage)

Toda request autenticada tem um contexto:

```ts
type TenantContext = {
  userId: string;
  contabilidadeId?: string;
  empresaId?: string;        // tenant_id efetivo
  role: Role;
};
```

Disponível via:
```ts
import { getTenantContext } from '@/modules/tenants/tenant-context';

const ctx = getTenantContext();
```

Setado pelo `TenantContextMiddleware` a partir do JWT Clerk + headers (em dev, `ALLOW_HEADER_AUTH=true` permite override).

### Bypass legítimo

Quando precisar cruzar tenants (ex.: lookup do próprio user, LGPD export):

```ts
import { withTenantContext } from '@/modules/tenants/tenant-context';

return withTenantContext(
  { role: 'platform_admin', userId },
  () => prisma.userMembership.findMany({ where: { userId } })
);
```

> Sempre auditar (`@Auditable()`) o uso desse bypass.

---

## 2. Route Handler Proxy

Padrão para chamar a API NestJS a partir do browser sem expor o JWT.

```
Browser
  └─ fetch('/api/lgpd/export', { credentials: 'include' })
     └─ Next.js Route Handler (server-side, em apps/web/src/app/api/*)
        ├─ const token = await auth().getToken()
        └─ fetchApi(`/api/lgpd/export`, { headers: { Authorization: `Bearer ${token}` } })
           └─ NestJS endpoint
```

Helper em `apps/web/src/lib/api-client.ts`:

```ts
export async function fetchApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}
```

Use em **toda** Route Handler que repassa para o backend.

---

## 3. Validação Zod compartilhada (single source of truth)

Schemas em `packages/shared/src/`:

```ts
// packages/shared/src/cadastros/empresa.ts
export const EmpresaCreateSchema = z.object({
  razaoSocial: z.string().min(2).max(200),
  cnpj: z.string().refine(isValidCnpj, 'CNPJ inválido'),
  regimeTributario: z.enum(['simples', 'presumido', 'real']),
});
export type EmpresaCreateInput = z.infer<typeof EmpresaCreateSchema>;
```

**Backend (NestJS):**
```ts
@Post()
create(@Body(new ZodValidationPipe(EmpresaCreateSchema)) dto: EmpresaCreateInput) { ... }
```

**Frontend (React Hook Form):**
```ts
const form = useForm<EmpresaCreateInput>({
  resolver: zodResolver(EmpresaCreateSchema),
});
```

Uma só fonte. Mudou no shared, ambos quebram no `tsc` — bom.

---

## 4. Auditoria

```ts
@Post()
@Roles('admin', 'contabilidade_owner')
@Auditable({ action: 'empresa.create', resourceType: 'empresa' })
create(@Body() dto: CreateEmpresaDto) { ... }
```

`AuditInterceptor` capta automaticamente: usuário, tenant, IP, user-agent, payload, resultado, timestamp.

Para auditar **dentro** de service (granularidade fina):

```ts
constructor(private readonly audit: AuditService) {}

async cancelar(id: string) {
  // ...
  await this.audit.log({
    action: 'nota.cancel',
    resourceType: 'nota_fiscal',
    resourceId: id,
    diff: { before, after },
    result: 'success',
  });
}
```

Ver [03-auditoria.md](03-auditoria.md).

---

## 5. Jobs assíncronos (BullMQ)

Tudo I/O-bound longo (emissão, importação parser, export grande, geração DANFE) vai para fila.

### Adicionar job
```ts
import { Queue } from 'bullmq';

constructor(@InjectQueue('emit-nfe') private readonly queue: Queue) {}

async enqueue(notaId: string) {
  await this.queue.add('emit', { notaId }, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },  // 5s, 10s, 20s, 40s, 80s
    removeOnComplete: 100,
    removeOnFail: 1000,
  });
}
```

### Worker
```ts
@Processor('emit-nfe')
export class EmitNfeProcessor extends WorkerHost {
  async process(job: Job<{ notaId: string }>) {
    await withTenantContext(/* ... */, () => emitirNota(job.data.notaId));
  }
}
```

> **Sempre re-estabelecer o tenant context dentro do worker.** A fila não preserva AsyncLocalStorage.

### Padrões
- **Idempotência** por `jobId` (`add('emit', data, { jobId: notaId })` — duplicatas viram no-op).
- **Retry** exponencial; após max attempts, alerta.
- **TTL**: `removeOnComplete` libera memória do Redis.
- **Concurrency**: `new Worker(name, fn, { concurrency: 5 })` por worker. Para emissão, manter baixo (1–3) para não sobrecarregar SEFAZ.

---

## 6. Server Actions (formulários simples)

Para forms sem lógica de negócio sensível, Server Action elimina o ciclo browser → Route Handler → NestJS.

```tsx
// apps/web/src/app/(app)/cadastros/empresas/novo/action.ts
'use server';

import { auth } from '@clerk/nextjs/server';
import { fetchApi } from '@/lib/api-client';

export async function createEmpresa(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('unauthorized');

  const parsed = EmpresaCreateSchema.parse(Object.fromEntries(formData));
  return fetchApi('/api/empresas', { method: 'POST', body: JSON.stringify(parsed) });
}
```

> Para emissão fiscal: prefira **API + BullMQ** (controle de retry, status assíncrono) em vez de Server Action.

---

## 7. Decimal — sem float

```ts
import { Decimal } from '@prisma/client/runtime/library';

const total = new Decimal(item.quantidade).mul(item.valorUnitario);
```

Em Prisma, colunas `Decimal` chegam como instância `Decimal` (biblioteca decimal.js-light). **Não converta para number** sem necessidade — perde precisão.

---

## 8. Datas — `America/Sao_Paulo`

Toda data fiscal (`dh_emi`, `dh_autorizacao`, `dh_canc`) em horário de Brasília.

```ts
import { formatInTimeZone } from 'date-fns-tz';

const dhEmi = new Date();  // UTC interno é OK
const formatado = formatInTimeZone(dhEmi, 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ssXXX");
// → "2026-04-25T14:32:11-03:00"
```

Para a SEFAZ, **sempre o offset explícito** `-03:00`.

---

## 9. Erros

### Hierarquia
```ts
class BusinessException extends Error {       // 4xx, esperado, NÃO captura no Sentry
  constructor(public code: string, message: string) { super(message); }
}

class FiscalException extends BusinessException {  // ex.: NF rejeitada, motivo SEFAZ
  constructor(public sefazCode: string, public sefazMessage: string) {
    super('FISCAL_ERROR', sefazMessage);
  }
}
```

`Sentry beforeSend`:
```ts
if (hint?.originalException instanceof BusinessException) return null;
```

### Filter global
```ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    if (err instanceof BusinessException) {
      // 4xx + body { code, message }
    } else {
      // 500 + Sentry capture
    }
  }
}
```

---

## 10. PII em logs

Camadas (ver [16-observabilidade.md](16-observabilidade.md)):

1. **Pino redact** com `pfxBuffer`, `pfxPassword`, `password`, `req.headers.authorization`, `cpfCnpj`.
2. **`safeLog` whitelist** — log só campos permitidos por contexto.
3. **`Sentry beforeSend`** — scrub adicional no event.
4. **Sentry UI scrubbers** — regex CPF/CNPJ/email.

**Nunca** `logger.log({ dto })` com payload completo. Sempre projete:
```ts
logger.log({ action: 'empresa.create', cnpjPrefix: dto.cnpj.slice(0, 6) });
```

---

## 11. Permissões

```ts
@Roles('admin', 'contabilidade_owner')   // qualquer um destes papéis
```

Decoradores compostos:
```ts
function ContabilidadeOwner() {
  return applyDecorators(
    UseGuards(ClerkGuard, RolesGuard),
    Roles('admin', 'contabilidade_owner'),
  );
}
```

> No frontend, a UI **também** filtra por papel — mas backend é a verdade. UI é só UX.

---

## 12. Testes

| Tipo | Ferramenta | Onde |
|------|-----------|------|
| Unit (services/utils) | Vitest | `apps/api/tests/`, `packages/*/tests/` |
| Contract RLS | Vitest | `apps/api/tests/rls-regression.spec.ts` |
| Contract RBAC | Vitest | `apps/api/tests/roles-guard-rbac.spec.ts` |
| Integração (DB real) | Vitest + testcontainers | `apps/api/tests/integration/` |
| E2E fiscal (homologação) | Playwright | `apps/web/e2e/` |

Tests críticos a manter passando em todo PR:
- `audit-interceptor.spec.ts`
- `safe-log.spec.ts`
- `rls-regression.spec.ts`
- `roles-guard-rbac.spec.ts`

---

## 13. Money + StatusPill

Componentes `@nexo/ui`:

```tsx
import { Money, StatusPill } from '@nexo/ui';

<Money value={1500.50} />  {/* "R$ 1.500,50" */}
<StatusPill variant="autorizada">Autorizada</StatusPill>
```

Sempre use estes — formatação BR consistente, paleta correta.

---

## 14. Cores e tipografia

Tokens (Tailwind 4 `@theme`):

```css
--color-primary: #1E5FD8;       /* azul Nexo */
--color-success: #1BA97A;       /* verde fiscal */
--color-danger: #E54848;        /* vermelho denegação */
--font-sans: Inter;
--font-mono: JetBrains Mono;    /* chaves NF-e, CNPJ */
```

Cores hard-coded em CSS = code review reject.

---

## 15. Convenções de commit

Mantidas convencionalmente (sem ferramenta enforce):

```
feat(modulo): descrição curta
fix(modulo): descrição
chore: tarefas operacionais
refactor: sem mudança de comportamento
docs: documentação (inclui esta wiki)
test: testes
```

Exemplos do histórico:
- `feat(auth): login gate single-user com cookie HMAC (modo prototipo)`
- `fix(api): gera prisma client antes do nest build`
- `chore(web): bump next 15.1.0 -> 15.5.15 (security patches)`

---

## 16. Anti-patterns

| Não faça | Por quê | Faça |
|----------|---------|------|
| Tabela domínio sem `tenant_id` | RLS impossível | Sempre incluir `tenant_id` UUID |
| Logar `dto` completo | Vaza CPF/CNPJ/payload | Projetar campos seguros |
| `xml-crypto` sem C14N explícito | Rejeição SEFAZ 297 | Configurar `canonicalizationAlgorithm` explicitamente |
| `.pfx` em filesystem ou env var | Risco criminal | KMS envelope encryption + S3 |
| Datadog no MVP | Bill imprevisível | Sentry + SigNoz/Grafana |
| Datas em UTC nos campos fiscais | SEFAZ rejeita | `America/Sao_Paulo -03:00` |
| `xml2js` em XMLs grandes | Lento, não preserva ordem | `fast-xml-parser` com `preserveOrder` |
| Hardcode `#1E5FD8` em arquivo CSS | Drift do design system | Token `bg-primary` (Tailwind) |
| `npm install` em vez de `pnpm` | Quebra workspaces | `pnpm install` sempre |
| Forçar push em main | Perda de histórico | Fluxo: branch → PR → merge |
| Edit fora de GSD workflow | Quebra rastreabilidade do projeto | `/gsd-quick` ou `/gsd-execute-phase` |

---

## 17. Setup local (resumo)

```bash
pnpm install
docker compose up -d postgres redis        # Postgres na 5434, Redis na 6380
cp .env.example .env.local                 # editar
pnpm --filter @nexo/api prisma migrate dev # cria schema + roles
pnpm --filter @nexo/api prisma db seed     # opcional: dados de exemplo
pnpm dev                                    # web :3000, api :3001
```

Reset do DB:
```bash
bash scripts/db-reset.sh    # ./db-reset.ps1 no Windows
```

Healthcheck:
```bash
curl http://localhost:3001/api/health
```

---

## 18. Checklist para uma nova rotina

Antes de marcar como `complete`:

- [ ] Modelo Prisma com `tenant_id` UUID + índice `(tenant_id, created_at DESC)`
- [ ] Migration aplicada (RLS policies se aplicável)
- [ ] Schemas Zod em `packages/shared`
- [ ] Endpoint NestJS com `@Roles()` + `@Auditable()`
- [ ] Service usa `getTenantContext()` (não `req.user.id`)
- [ ] Frontend usa `fetchApi` (não `fetch` direto)
- [ ] React Hook Form + Zod resolver
- [ ] Componentes shadcn/ui (não DIY)
- [ ] Sem PII em logs
- [ ] Tests: unit + RLS regression
- [ ] Wiki atualizada (este diretório)
