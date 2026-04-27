# 13 — Auditoria (visualizador)

## Visão geral

Tela do `audit_log` para uso por administradores e contadores em auditorias internas / fiscalizações. Backend de auditoria (gravação) está coberto em [03-auditoria.md](03-auditoria.md) — esta rotina é **só a UI de leitura** + endpoint de export.

## Status atual

**Scaffolded** — página placeholder. Backend (gravação) está completo.

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/auditoria/page.tsx` — placeholder

### Backend (planejado)
- `apps/api/src/modules/audit/audit-query.controller.ts` — `GET /api/audit/logs`, `GET /api/audit/export`
- `apps/api/src/modules/audit/audit-query.service.ts`

## Funcionalidades

### Listagem (paginada, server-side)
Filtros:
- Período (default: últimos 7 dias)
- `action` (select com autocomplete — alimentado por `distinct(action)`)
- `resourceType`
- `resourceId` (input livre, busca exata)
- `userId` ou e-mail (autocomplete — busca em `users.email`)
- `result` (success / denied / error)
- IP (input livre)

Colunas:
- Data/hora (`America/Sao_Paulo`, formato `dd/MM/yyyy HH:mm:ss`)
- Usuário (e-mail + role no momento)
- Ação
- Recurso (tipo + id, link clicável quando aplicável)
- Resultado
- IP

Ações por linha:
- Ver detalhes (`<DiffViewer>` para o JSONB `diff`)

### Diff viewer
Componente que recebe `diff: { before?: object, after?: object }` e renderiza em estilo `react-diff-viewer` ou similar — destaca campos alterados.

### Export
- CSV (até 50.000 linhas em sync; acima, BullMQ + e-mail com link presigned do S3)
- JSON (estrutura completa, incluindo `diff`)
- PDF (relatório formatado para impressão; agrupa por dia, sumariza por ação)

Endpoint:
```
GET /api/audit/export?format=csv&from=2026-04-01&to=2026-04-25&...
```

Headers:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-{tenant}-{from}-{to}.csv"
```

## Endpoints (planejados)

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| GET | `/api/audit/logs` | Lista paginada | `admin`, `contabilidade_owner`, `empresa_owner` |
| GET | `/api/audit/logs/:id` | Detalhe (diff completo) | idem |
| GET | `/api/audit/export` | CSV/JSON/PDF | idem |
| GET | `/api/audit/actions` | Distinct list para autocomplete | idem |

> **Escopo:** `admin` vê tudo da plataforma (`platform_admin` bypass). `contabilidade_owner` vê só audit_log das empresas vinculadas. `empresa_owner` vê só do próprio tenant.

## Padrão de query

```ts
async list(ctx: TenantContext, filter: AuditFilterDto) {
  const where: Prisma.AuditLogWhereInput = {
    createdAt: { gte: filter.from, lte: filter.to },
    ...(filter.action && { action: filter.action }),
    ...(filter.userId && { userId: filter.userId }),
    ...(filter.result && { result: filter.result }),
  };

  // Escopo automático
  if (ctx.role !== 'admin') {
    if (ctx.empresaId) {
      where.tenantId = ctx.empresaId;
    } else if (ctx.contabilidadeId) {
      const empresas = await this.empresasDoContab(ctx.contabilidadeId);
      where.tenantId = { in: empresas.map(e => e.tenantId) };
    }
  }

  return this.prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filter.pageSize,
    skip: (filter.page - 1) * filter.pageSize,
  });
}
```

## Padrões e ressalvas

- **Sempre filtrar por período.** Sem isso, query passa por todas as partições — full scan.
- **Index `(tenant_id, created_at DESC)`** é a base; queries mais complexas usam `(action, created_at DESC)`.
- **Não permitir DELETE/UPDATE em UI.** Mesmo se a UI aceitasse, o trigger DB rejeitaria. Mas evite confundir o usuário.
- **Auditar a auditoria:** o próprio acesso ao `/api/audit/logs` é registrado (`action: 'audit.view'`). Quem quer ver os outros, deixa rastro.
- **Performance grandes diffs:** `diff` JSONB pode ser MB. Endpoint `:id` carrega completo; `list` retorna `diff: null` para economizar payload — UI só carrega quando expande linha.
- **Queries longas em export** rodam em job (BullMQ); UI mostra "Exportação em preparação, link enviado por e-mail".
- **Privacidade:** dados sensíveis em `diff` (e-mail, CPF parcial mostrado em formulário). Mascarar antes de exibir? Decisão: NÃO mascarar — a auditoria é para investigar; mascaramento esconde a investigação. Acesso restrito a roles privilegiados.

## Bibliotecas

| Pacote | Papel |
|--------|-------|
| `@tanstack/react-table` 8.x | Tabela densa |
| `react-diff-viewer-continued` | Diff JSON antes/depois |
| `date-fns-tz` 4.x | Format BR |
| `papaparse` | CSV server-side em Node |
| `pdfkit` ou `puppeteer-core` | PDF |

## Próximos passos

- [ ] Endpoints `/api/audit/*` com filtros Zod
- [ ] Página `/auditoria` com filtros + DataTable
- [ ] `<DiffViewer>` componente
- [ ] Export sync (≤ 50k) e async (BullMQ + e-mail)
- [ ] Autocomplete de actions e users
- [ ] Linkar `resourceId` para a página correspondente quando aplicável (ex.: `nota_fiscal/{id}` → `/documentos/{id}`)
