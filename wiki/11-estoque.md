# 11 — Estoque (controle simplificado)

## Visão geral

Controle de estoque **derivado das movimentações fiscais** — não é WMS profissional. Movimentos:

- **Entrada** — automática ao confirmar XML de compra ([10-importacao-xml.md](10-importacao-xml.md)).
- **Saída** — automática ao emitir NF-e ([09-emissao.md](09-emissao.md)).
- **Devolução** — ao emitir nota com `finNFe=4` (estorna saída).
- **Ajuste manual** — usuário com papel `empresa_owner+` corrige saldo (com motivo, auditado).

Multi-localização (depósitos) é Fase 3+. MVP: estoque único por empresa.

## Status atual

**Scaffolded.** Página placeholder.

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/estoque/page.tsx` — listagem por SKU + filtros (placeholder)
- *(planejado)* `src/app/(app)/estoque/[produtoId]/page.tsx` — extrato de movimentações
- *(planejado)* `src/components/estoque/movimento-form.tsx` — ajuste manual

### Backend (planejado)
- `apps/api/src/modules/estoque/estoque.module.ts`
- `apps/api/src/modules/estoque/estoque.controller.ts`
- `apps/api/src/modules/estoque/estoque.service.ts`
- `apps/api/src/modules/estoque/estoque.listeners.ts` — escuta eventos `nota.autorizada` / `import.confirmada`

## Modelo de dados (planejado)

```prisma
model EstoqueSaldo {
  tenantId    String   @db.Uuid @map("tenant_id")
  produtoId   String   @db.Uuid @map("produto_id")
  saldo       Decimal  @db.Decimal(15, 4)  // 4 casas para unidades pequenas (ex.: KG)
  custoMedio  Decimal  @db.Decimal(15, 4)  // custo médio ponderado
  atualizadoEm DateTime @updatedAt @map("atualizado_em")

  @@id([tenantId, produtoId])
  @@map("estoque_saldo")
}

model EstoqueMovimento {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @db.Uuid @map("tenant_id")
  produtoId   String   @db.Uuid @map("produto_id")
  tipo        String   // 'entrada' | 'saida' | 'ajuste' | 'devolucao'
  quantidade  Decimal  @db.Decimal(15, 4)
  valorUnit   Decimal  @db.Decimal(15, 4)
  origem      String   // 'nf-e-emitida' | 'nf-e-recebida' | 'ajuste-manual'
  origemId    String?  @db.Uuid  // FK opcional para nota_fiscal
  motivo      String?  // ajuste manual exige
  createdAt   DateTime @default(now())
  createdBy   String?  @db.Uuid

  @@index([tenantId, produtoId, createdAt(sort: Desc)])
  @@index([tenantId, createdAt(sort: Desc)])
  @@map("estoque_movimento")
}
```

## Endpoints (planejados)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/estoque` | Lista saldos com filtros (SKU, descrição, abaixo do mínimo) |
| GET | `/api/estoque/:produtoId/movimentos` | Extrato (paginado por data) |
| POST | `/api/estoque/:produtoId/ajuste` | Ajuste manual (exige motivo) |

## Fluxo automático

```
nota.autorizada (NF-e emitida)
  └── EstoqueListener
      └── para cada item:
          tx (Prisma + advisory lock por (tenantId, produtoId)):
            saldo -= qty
            insert movimento(tipo='saida', origem='nf-e-emitida')
          custo médio: NÃO altera (saída não muda CMC)

import.confirmada (XML de compra)
  └── EstoqueListener
      └── para cada item:
          tx:
            novoSaldo = saldo + qty
            CMC = (saldo*CMC + qty*valorUnit) / novoSaldo
            saldo = novoSaldo
            insert movimento(tipo='entrada', origem='nf-e-recebida')
```

> **Advisory lock** por `(tenantId, produtoId)` evita race em emissões/importações concorrentes do mesmo SKU.

## Padrões e ressalvas

- **Decimal(15, 4)** — quatro casas decimais aguentam unidades pequenas (KG/g) sem float drift.
- **Idempotência:** o listener checa se já existe movimento com (origem, origemId) antes de inserir. Reentrega de evento não duplica.
- **Saldo negativo permitido** (com warning), porque a operação fiscal pode ter sido emitida antes do XML de compra chegar. Ajuste posterior corrige.
- **Custo médio ponderado** é o padrão tributário no Brasil. Outros métodos (FIFO/LIFO) ficam para Fase 4.
- **Ajuste manual** = `EstoqueMovimento` + `audit_log` com motivo. Sem migration, sem tabela "auditoria de estoque" separada.
- **Sem multi-depósito no MVP.** Quando entrar, `EstoqueSaldo` ganha `depositoId` no PK.
- **Alerta de mínimo:** [12-alertas.md](12-alertas.md) — campo opcional `produtos.estoqueMinimo`. Job diário compara saldo < mínimo → cria alerta.

## Bibliotecas

| Pacote | Papel |
|--------|-------|
| `@prisma/client` | Transações + advisory lock |
| `@nestjs/event-emitter` | Listeners desacoplados |
| `decimal.js` (opcional) | Aritmética decimal precisa em código |

## Próximos passos

- [ ] Modelos `EstoqueSaldo` + `EstoqueMovimento`
- [ ] Listener `nota.autorizada` (saída)
- [ ] Listener `import.confirmada` (entrada + CMC)
- [ ] Endpoint extrato com filtros
- [ ] UI: listagem + drilldown extrato
- [ ] Alertas de saldo mínimo
- [ ] Multi-depósito (Fase 3+)
- [ ] Inventário (Fase 4) — congelamento de saldo + contagem
