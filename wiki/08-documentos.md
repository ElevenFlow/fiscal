# 08 — Documentos (consulta de notas fiscais)

## Visão geral

Listagem unificada de **todos os documentos fiscais** ligados a uma empresa: NFS-e emitidas, NF-e emitidas, devoluções, notas recebidas (importadas via XML).

Filtros:
- Tipo (NFS-e, NF-e, devolução, importada)
- Status (autorizada, denegada, cancelada, rascunho)
- Período
- Cliente/fornecedor (CPF/CNPJ)
- Valor (de/até)
- Texto livre (chave de acesso, número, descrição)

Ações por linha:
- Ver detalhes (XML em viewer formatado)
- Baixar XML
- Baixar DANFE/DANFSE
- Reenviar por e-mail
- Cancelar (se elegível: dentro de 24h NF-e, regras municipais NFS-e)
- Solicitar CC-e (NF-e — até 720h)

## Status atual

**Scaffolded.** Página placeholder.

| Componente | Status |
|-----------|--------|
| Página `(app)/documentos/page.tsx` | Placeholder "Em breve" |
| Modelo Prisma `NotaFiscal` | **Não criado** |
| Endpoints `/api/notas` | Não criados |
| DataTable + filtros | Não construídos |
| Viewer de XML | Não construído |

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/documentos/page.tsx` — list (placeholder)
- *(planejado)* `src/app/(app)/documentos/[id]/page.tsx` — detalhe
- *(planejado)* `src/components/documentos/xml-viewer.tsx`
- *(planejado)* `src/components/documentos/timeline.tsx` — eventos da nota (autorização, cancelamento, CC-e)
- *(planejado)* `src/components/documentos/filtros.tsx`

### Backend (planejado)
- `apps/api/src/modules/notas/notas.controller.ts` — `GET /api/notas`, `GET /api/notas/:id`, ações
- `apps/api/src/modules/notas/notas.service.ts`

## Modelo de dados (planejado)

```prisma
model NotaFiscal {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid @map("tenant_id")
  tipo           String   // 'nfe' | 'nfse' | 'devolucao' | 'importada'
  ambiente       String   // 'producao' | 'homologacao'
  status         String   // 'rascunho' | 'enviada' | 'autorizada' | 'denegada' | 'cancelada' | 'rejeitada'
  chaveAcesso    String?  @unique @map("chave_acesso")  // NF-e 44 chars
  numero         String?
  serie          String?
  rps            String?  // NFS-e
  dhEmi          DateTime @db.Timestamptz(6) @map("dh_emi")  // sempre America/Sao_Paulo
  dhAutorizacao  DateTime? @db.Timestamptz(6)
  destinatarioCpfCnpj String? @map("destinatario_cpf_cnpj")
  destinatarioNome    String? @map("destinatario_nome")
  valorTotal     Decimal  @db.Decimal(15, 2)
  motivoRejeicao String?
  protocolo      String?  // protocolo SEFAZ/Prefeitura
  xmlS3Key       String?  // chave em [04-armazenamento-s3.md]
  pdfS3Key       String?
  gateway        String?  // 'focus_nfe' | 'plug_notas' | 'interno'
  payload        Json?    // resposta bruta do gateway
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, createdAt(sort: Desc)])
  @@index([tenantId, tipo, status])
  @@index([destinatarioCpfCnpj])
  @@map("nota_fiscal")
}

model NotaFiscalEvento {
  id           String   @id @default(uuid()) @db.Uuid
  notaFiscalId String   @db.Uuid @map("nota_fiscal_id")
  tenantId     String   @db.Uuid @map("tenant_id")  // redundante, agiliza RLS
  evento       String   // 'autorizada' | 'cancelada' | 'cce' | 'denegada' | 'reenviada_email'
  detalhes     Json?
  createdAt    DateTime @default(now()) @db.Timestamptz(6)

  notaFiscal NotaFiscal @relation(fields: [notaFiscalId], references: [id])

  @@index([tenantId, createdAt(sort: Desc)])
  @@map("nota_fiscal_evento")
}
```

> **Particionar por `tenant_id + ano`** (`pg_partman`) quando volume superar ~10M linhas/tenant.

## Endpoints (planejados)

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| GET | `/api/notas` | Lista paginada com filtros | todos os papéis empresa+contab |
| GET | `/api/notas/:id` | Detalhe + eventos | idem |
| GET | `/api/notas/:id/xml` | Stream XML do S3 (presigned 5 min) | idem (auditado) |
| GET | `/api/notas/:id/pdf` | Stream DANFE/DANFSE | idem |
| POST | `/api/notas/:id/cancel` | Solicita cancelamento | owner+operador |
| POST | `/api/notas/:id/cce` | Carta de correção (NF-e) | owner+operador |
| POST | `/api/notas/:id/email` | Reenvia ao destinatário | todos exceto leitura |

## Padrões e ressalvas

- **Fonte de verdade é o XML** no S3 com Object Lock. O DB é índice/projeção.
- **Cancelamento NF-e:** janela de 24h após autorização (legal). UI desabilita botão fora da janela.
- **CC-e:** até 720h (30 dias) e só para campos não-substanciais (não pode mudar valor, CNPJ destinatário, data emissão).
- **Não confunda evento NF-e (cancelamento, CC-e, manifestação)** com nota nova. Evento gera novo XML assinado e anexado à nota original.
- **NFS-e** varia por município — alguns devolvem PDF, outros só XML; tela de detalhe precisa lidar com ausência de PDF.
- **Buscas por CPF/CNPJ** ficam em índice; busca livre em texto pode usar `pg_trgm` em descrição/razão social.
- **Audit log** em todo download (`storage.download`) com `chaveAcesso`.

## Bibliotecas

| Pacote | Papel |
|--------|-------|
| `@tanstack/react-table` 8.x | Tabela com filtros server-side |
| `fast-xml-parser` 4.5+ | Parse para o viewer |
| `react-syntax-highlighter` | Realce do XML no viewer |

## Próximos passos

- [ ] Modelos Prisma `NotaFiscal` + `NotaFiscalEvento` + migration com particionamento
- [ ] Endpoint `GET /api/notas` com filtros (Zod)
- [ ] Página de detalhe com `<XmlViewer>` + `<Timeline>` de eventos
- [ ] Botões: cancelar, CC-e, reenviar e-mail (Resend)
- [ ] Export CSV/XLSX da listagem (BullMQ se >5000 linhas)
- [ ] Filtro por gateway (auditoria operacional)
- [ ] Integração com [12-alertas.md](12-alertas.md): alertar denegações na lista
