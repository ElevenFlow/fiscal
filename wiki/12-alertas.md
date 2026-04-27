# 12 — Alertas (notificações operacionais)

## Visão geral

Centro de alertas operacionais e fiscais. Sininho no header (`<NotificationBell>`) mostra contagem de alertas críticos não-lidos; página `/alertas` lista todos com filtros.

Tipos de alerta cobertos:

| Tipo | Severidade | Origem |
|------|:---:|--------|
| Certificado A1 vencendo (60/30/15/7/0 dias) | warn → critical | Cron diário |
| Certificado A1 vencido | critical | Cron diário |
| SEFAZ fora do ar (UF) | warn | Circuit breaker |
| Nota denegada | error | Worker emissão |
| Nota rejeitada por validação | error | Worker emissão |
| Importação com chave duplicada | info | Worker import |
| Importação com NCM divergente | warn | Worker import |
| Saldo de estoque abaixo do mínimo | info | Cron diário |
| RPS prestes a ser invalidado (NFS-e) | warn | Cron diário |
| Webhook Clerk falhou múltiplas vezes | error | Health check |
| Tentativa repetida de download bloqueado por prefix guard | critical | Cron horário |

## Status atual

**Scaffolded.**

| Componente | Status |
|-----------|--------|
| `<NotificationBell>` no header | UI pronta, dados mockados |
| Página `/alertas` | Placeholder |
| Modelo `Alerta` | Não criado |
| Endpoint `/api/alertas` | Não criado |
| Geradores (cron + listeners) | Não criados |

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/alertas/page.tsx` — placeholder
- `src/components/shell/notification-bell.tsx` — sino com badge

### Backend (planejado)
- `apps/api/src/modules/alertas/alertas.module.ts`
- `apps/api/src/modules/alertas/alertas.controller.ts`
- `apps/api/src/modules/alertas/alertas.service.ts`
- `apps/api/src/modules/alertas/listeners/*` — `nota.denegada`, `import.duplicada` etc.
- `apps/api/src/jobs/check-cert-expiry.processor.ts` (BullMQ cron)
- `apps/api/src/jobs/check-sefaz-status.processor.ts`

## Modelo de dados (planejado)

```prisma
model Alerta {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid @map("tenant_id")
  tipo          String   // ver enum acima — slug 'cert.expirando', 'nota.denegada' etc.
  severidade    String   // 'info' | 'warn' | 'error' | 'critical'
  titulo        String
  mensagem      String
  metadata      Json?    // referências (notaFiscalId, certId, uf, etc.)
  lida          Boolean  @default(false)
  lidaPor       String?  @db.Uuid @map("lida_por")
  lidaEm        DateTime? @map("lida_em")
  resolvida     Boolean  @default(false)
  resolvidaPor  String?  @db.Uuid @map("resolvida_por")
  resolvidaEm   DateTime? @map("resolvida_em")
  createdAt     DateTime @default(now())

  @@index([tenantId, lida, severidade, createdAt(sort: Desc)])
  @@index([tenantId, tipo, metadata])  // para deduplicação
  @@map("alertas")
}
```

## Endpoints (planejados)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/alertas` | Lista com filtros (severidade, tipo, lida, range) |
| GET | `/api/alertas/contagem` | `{ critical, error, warn, info, total_unread }` para o sininho |
| PATCH | `/api/alertas/:id/ler` | Marca lida |
| PATCH | `/api/alertas/:id/resolver` | Marca resolvida (com nota opcional) |
| POST | `/api/alertas/marcar-todas-lidas` | Bulk |

## Geradores

### Cron diário — certificado vencendo
```ts
@Cron('0 9 * * *', { timeZone: 'America/Sao_Paulo' })
async checkCerts() {
  const certs = await this.prisma.certA1.findMany({ where: { ativo: true } });
  for (const c of certs) {
    const dias = differenceInDays(c.expiresAt, new Date());
    if ([60, 30, 15, 7, 0].includes(dias) || dias < 0) {
      await this.alertas.create({
        tenantId: c.tenantId,
        tipo: dias < 0 ? 'cert.vencido' : 'cert.expirando',
        severidade: dias <= 7 ? 'critical' : 'warn',
        titulo: dias < 0 ? 'Certificado A1 vencido' : `Certificado A1 vence em ${dias} dias`,
        mensagem: `O certificado ${c.fingerprint.slice(0, 8)} ${dias < 0 ? 'venceu' : 'expira'} em ${format(c.expiresAt, 'dd/MM/yyyy')}.`,
        metadata: { certId: c.id, fingerprint: c.fingerprint },
      });
    }
  }
}
```

### Listener — nota denegada
```ts
@OnEvent('nota.denegada')
async onDenegada(payload: NotaDenegadaEvent) {
  await this.alertas.create({
    tenantId: payload.tenantId,
    tipo: 'nota.denegada',
    severidade: 'error',
    titulo: `Nota ${payload.numero} denegada`,
    mensagem: payload.motivo,
    metadata: { notaFiscalId: payload.notaId, codigoSefaz: payload.codigo },
  });
}
```

### Deduplicação

Antes de criar, o service checa: existe alerta do mesmo (tenant, tipo, metadata.identificador-chave) **não resolvido** nas últimas 24h? Se sim, atualiza `createdAt` e incrementa contador em `metadata.ocorrencias`.

```sql
-- exemplo: cert vencendo do mesmo cert+dias não duplica
WHERE tenant_id = $1
  AND tipo = 'cert.expirando'
  AND metadata->>'certId' = $2
  AND resolvida = false
  AND created_at > now() - interval '24 hours'
```

## UI

### NotificationBell (já existe)
- Badge com contagem de `severidade IN ('critical', 'error')` não-lidas.
- Dropdown lista 5 mais recentes; "Ver todas" → `/alertas`.
- Cores por severidade:
  - `critical` — vermelho `#E54848`
  - `error` — laranja
  - `warn` — amarelo
  - `info` — azul `#1E5FD8`

### Página `/alertas`
- Tabs: "Não lidas" | "Todas" | "Resolvidas"
- Filtros: severidade, tipo, período
- Bulk: marcar como lida / resolver

## Notificação externa (futuro)

- E-mail (Resend) para `severidade='critical'` se não-lida em 1h.
- WhatsApp (Twilio ou Z-API) opt-in por contabilidade.
- Webhook configurável por tenant (`/api/configuracoes/webhooks`).

## Padrões e ressalvas

- **Severidade vs Tipo:** severidade controla a UX (cor, urgência). Tipo identifica o "quê" para deduplicação.
- **`resolvida` é distinto de `lida`.** Lida é "o usuário viu"; resolvida é "o problema sumiu/foi tratado".
- **Auto-resolução:** alguns alertas resolvem-se sozinhos. Ex.: SEFAZ volta → cron marca alerta `sefaz.fora-ar` como `resolvida`. Worker emite evento.
- **Não criar alerta para tudo.** Eventos rotineiros (login, edit) ficam em `audit_log`. Alerta = ação esperada do usuário.
- **TTL implícito:** alertas resolvidos > 90 dias podem ser arquivados (soft) — query padrão filtra resolvidos.

## Bibliotecas

| Pacote | Papel |
|--------|-------|
| `@nestjs/event-emitter` | Listeners desacoplados |
| `@nestjs/schedule` | Cron jobs (`@Cron`) |
| `bullmq` 5.x | Jobs com retry (alternativa a `@nestjs/schedule`) |
| `date-fns-tz` 4.x | Cron em `America/Sao_Paulo` |

## Próximos passos

- [ ] Modelo `Alerta` + migration
- [ ] Endpoints CRUD + contagem (em real-time via SSE no sininho?)
- [ ] Geradores cron + listeners (1 por tipo)
- [ ] Sistema de deduplicação
- [ ] Política de auto-resolução (SEFAZ volta, cert renovado)
- [ ] Notificação por e-mail em `critical` não-lida
- [ ] Webhook configurável por tenant
- [ ] Dashboard mostra resumo de alertas críticos
