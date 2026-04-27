# 05 — Portal LGPD do titular

## Visão geral

Implementação dos direitos do titular previstos na **LGPD (Arts. 7, 16, 18 e 48)**:

- **Exportar** todos os dados pessoais do titular (JSON).
- **Solicitar correção** de dado incorreto (gera protocolo).
- **Solicitar exclusão** — não-destrutiva: anonimiza dados não-fiscais; dados fiscais (notas, audit_log) são retidos por exigência tributária (CTN 173/174).

Inclui também a página pública de privacidade com identificação do encarregado (DPO) e os direitos do titular.

## Status atual

| Componente | Status |
|-----------|--------|
| Página pública `/privacidade` | Complete |
| Portal autenticado `/app/privacidade` | Complete |
| `LgpdService` com `exportUserData`, `requestCorrection`, `requestDeletion` | Complete |
| `LgpdController` (`/api/lgpd/*`) | Complete |
| Route Handlers Next como proxy seguro | Complete |
| Componentes UI (`ExportDataButton`, `DeleteDataForm`) | Complete |
| Notificação ANPD em até 72h por incidente | Procedimento operacional, não automatizado |

## Arquivos envolvidos

### Backend (apps/api)
- `src/modules/lgpd/lgpd.module.ts`
- `src/modules/lgpd/lgpd.service.ts` — agrega dados do titular, gera protocolos
- `src/modules/lgpd/lgpd.controller.ts` — endpoints `/api/lgpd/*`

### Frontend (apps/web)
- `src/app/(public)/privacidade/page.tsx` — política pública (DPO, base legal, retenção)
- `src/app/(app)/app/privacidade/page.tsx` — portal do titular (exigência LGPD)
- `src/app/api/lgpd/export/route.ts` — proxy: chama NestJS com Bearer
- `src/app/api/lgpd/delete/route.ts` — proxy: chama NestJS com Bearer
- `src/components/lgpd/export-data-button.tsx`
- `src/components/lgpd/delete-data-form.tsx`

## Endpoints

### `GET /api/lgpd/export`

**Auth:** Clerk Bearer (qualquer papel)
**Resposta:**
```jsonc
{
  "user": { "id", "email", "createdAt", "updatedAt" },
  "memberships": [ { "scopeType", "scopeId", "role" } ],
  "auditLog": [ /* últimos 1000 registros do userId, MVP cap */ ],
  "_metadata": { "exportedAt", "format": "json", "schemaVersion": "1.0" }
}
```

Resposta com `Content-Disposition: attachment; filename="nexo-fiscal-export-{userId}-{date}.json"`.

### `POST /api/lgpd/correction-request`

**Body Zod:**
```ts
{
  field: string,        // ex.: 'email'
  newValue: string,     // ≤ 1000 chars
  justification: string // ≤ 2000 chars
}
```
**Resposta:** `{ protocolId: 'LGPD-CORR-{ts}-{userIdSlice}' }`.

> O atendimento real à correção é manual (DPO + suporte). O protocolo entra no `audit_log` para SLA de 15 dias.

### `POST /api/lgpd/deletion-request`

**Body:** `{ reason: string  /* ≤ 2000 chars */ }`
**Resposta:** `{ protocolId: 'LGPD-DEL-{ts}-{userIdSlice}' }`.

**Comportamento:**
- Anonimiza `users.email` para `deleted-{userId}@anonimizado.local`.
- Remove `clerk_user_id` e desconecta do Clerk.
- **Mantém:** `audit_log`, `nota_fiscal`, XMLs no S3 (compliance fiscal — CTN 173/174).
- Mensagem na UI deixa explícito que dados fiscais são retidos por **exigência legal**, não por escolha da plataforma.

## Modelo Route Handler Proxy

Cliente nunca toca o JWT. Fluxo:

```
Browser
  └─ fetch('/api/lgpd/export', { credentials: 'include' })
     └─ Next.js Route Handler (server-side)
        ├─ const token = await auth().getToken()
        └─ fetch(`${API_URL}/api/lgpd/export`, { headers: { Authorization: `Bearer ${token}` }})
           └─ NestJS endpoint
              └─ ClerkGuard valida → withTenantContext({ role: 'platform_admin', userId })
                 └─ Prisma reads user data
```

Veja padrão completo em [99-padroes-desenvolvimento.md](99-padroes-desenvolvimento.md#route-handler-proxy).

## Bypass legítimo `withTenantContext`

A exportação cruza tenants intencionalmente — o usuário pode ter membership em várias contabilidades. Usamos:

```ts
return withTenantContext(
  { role: 'platform_admin', userId },
  () => this.exportInternal(userId)
);
```

Toda invocação é auditada (`action: 'lgpd.export'`).

## Geração de protocolo

```ts
function makeProtocol(prefix: 'CORR' | 'DEL', userId: string): string {
  const ts = Date.now();
  const slice = userId.replace(/-/g, '').slice(0, 8);
  return `LGPD-${prefix}-${ts}-${slice}`;
}
```

Determinístico, sem tabela dedicada — protocolo + payload são gravados em `audit_log`. Operações reais (correção/exclusão) atendidas via runbook do DPO usando o protocolo como chave.

## Limites e validação (Zod)

```ts
const requestCorrectionSchema = z.object({
  field: z.string().min(1).max(100),
  newValue: z.string().max(1000),
  justification: z.string().max(2000),
});

const requestDeletionSchema = z.object({
  reason: z.string().max(2000),
});
```

Anti-DoS: payload acima de limites é rejeitado em 400 sem chegar ao banco.

## Mitigações de ameaça implementadas

| Ameaça | Mitigação | Onde |
|--------|-----------|------|
| T-09-01: PII vazando em logs | `safeLog` whitelist + Pino redact + Sentry beforeSend | `src/modules/audit/`, `src/logger/` |
| T-09-04: usuário acha que deletou tudo | Mensagem UI explícita sobre retenção fiscal | `(app)/app/privacidade/page.tsx` |
| T-09-05: DoS via payload gigante | Limites Zod (2000/1000 chars) | `lgpd.service.ts` |
| T-09-06: titular falso solicita exportação | Auth Clerk obrigatório + `withTenantContext({ userId })` | `lgpd.controller.ts` |

## Página pública `/privacidade`

Conteúdo mínimo (LGPD Art. 8):
- Identificação do controlador (CNPJ Nexo Fiscal)
- Encarregado / DPO (e-mail e telefone)
- Bases legais (consentimento, execução de contrato, obrigação legal, exercício regular de direito)
- Categorias de dados tratados
- Compartilhamento (Clerk, AWS, gateways fiscais)
- Direitos do titular + canal (`/app/privacidade`)
- Retenção (5+ anos para dados fiscais)
- Política de cookies

## Bibliotecas

| Pacote | Versão | Papel |
|--------|--------|-------|
| `zod` | 3.23+ | Validação de payloads |
| `@nestjs/common` | 11.x | Decorators + DI |
| `@clerk/nextjs` | latest | Autenticação no portal |

## Próximos passos

- [ ] Email automatizado ao titular ao gerar protocolo (Resend) com SLA de 15 dias
- [ ] Painel admin para DPO listar protocolos pendentes (com SLA)
- [ ] Endpoint `GET /api/lgpd/protocols/:id` para o titular consultar status
- [ ] Auditoria periódica: notificação ANPD em até 72h por incidente (procedimento documentado em `docs/INCIDENT_RUNBOOK.md` — pendente)
- [ ] Sub-export — dividir export grande em ZIP com partes JSON quando audit_log do usuário > 10 MB
