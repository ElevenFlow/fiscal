# 10 — Importação de XML de compra

## Visão geral

Recebimento e indexação de **XMLs de NF-e/NFS-e recebidas pela empresa** (compras + serviços contratados). Suporte a:

- **Upload manual** — usuário arrasta arquivos `.xml` ou `.zip`.
- **Manifestação automática** (futuro) — *Distribuição DFe* da SEFAZ baixa XMLs autorizados em nome do destinatário.
- **E-mail dedicado** (futuro) — `xml@empresa.nexofiscal.com.br` recebe XMLs anexos.

Após receber, o XML passa por:
1. Validação de assinatura (XMLDSig).
2. Parse e extração de campos (`fast-xml-parser`).
3. Detecção de duplicidade (chave de acesso).
4. Conferência: existe esse fornecedor? esses produtos? CFOP coerente?
5. Tela de revisão para o usuário **conciliar**: cadastrar novo fornecedor, criar produtos com SKUs internos, ajustar conta contábil.
6. Confirmação → grava em `nota_fiscal` como `tipo='importada'` e dispara movimentação de estoque ([11-estoque.md](11-estoque.md)).

## Status atual

**Scaffolded.**

| Componente | Status |
|-----------|--------|
| Página `/importar` (upload) | Placeholder |
| Página `/importar/revisar/[id]` | Placeholder |
| Validação XMLDSig | Não implementada |
| Parser → DB | Não implementado |
| Job BullMQ `parse-import-xml` | Planejado |
| Distribuição DFe | Planejado (Fase 3) |
| Inbox de e-mail | Planejado (Fase 3) |

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/importar/page.tsx` — upload + lista de imports recentes
- `src/app/(app)/importar/revisar/[id]/page.tsx` — revisão / conciliação

### Backend (planejado)
- `apps/api/src/modules/importacao/importacao.module.ts`
- `apps/api/src/modules/importacao/importacao.controller.ts` — `POST /api/importacao/upload`, `POST /api/importacao/:id/confirm`
- `apps/api/src/modules/importacao/importacao.service.ts`
- `apps/api/src/jobs/parse-import-xml.processor.ts`

### Package
- `packages/xml-tools/src/parse-nfe.ts` — extrator com `fast-xml-parser` + `preserveOrder`
- `packages/xml-tools/src/validate-signature.ts` — verifica `<Signature>` contra cadeia ICP-Brasil

## Modelo de dados (planejado)

```prisma
model ImportXml {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid @map("tenant_id")
  uploadedBy     String   @db.Uuid @map("uploaded_by")  // userId
  filename       String   // nome original
  xmlS3Key       String   @map("xml_s3_key")
  status         String   // 'recebido' | 'validado' | 'duplicado' | 'rejeitado' | 'pendente_revisao' | 'confirmado' | 'descartado'
  motivoRejeicao String?
  chaveAcesso    String?
  emitenteCnpj   String?
  emitenteNome   String?
  valorTotal     Decimal? @db.Decimal(15, 2)
  dadosExtraidos Json?    // payload normalizado (header + items)
  notaFiscalId   String?  @db.Uuid  // FK quando confirmado vira NotaFiscal
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([tenantId, chaveAcesso])  // dedupe
  @@index([tenantId, status, createdAt(sort: Desc)])
  @@map("import_xml")
}
```

## Fluxo do upload

```
1. Drag-and-drop ou seletor de arquivos (multi-file)
2. POST /api/importacao/upload (multipart)
   • Limite: 100 arquivos por request, 5 MB cada
3. Backend grava raw XML no S3 (kind: 'import-xml')
4. Insert ImportXml status='recebido'
5. Enfileira job parse-import-xml
6. Retorna 202 com lista de IDs

Worker:
1. Baixa XML do S3
2. Valida assinatura (xml-crypto + cadeia ICP-Brasil)
   • Falha → status='rejeitado'
3. fast-xml-parser → extrai header + items
4. Procura chave_acesso em nota_fiscal e import_xml
   • Existe → status='duplicado'
5. Salva dadosExtraidos (jsonb)
6. status='pendente_revisao'
7. Cria alerta se forçoso (ver [12-alertas.md])
```

## Tela de revisão

Layout:
- **Header:** emitente (CNPJ/nome — link para cadastro), número, série, valor total, data.
- **Itens:** tabela com SKU sugerido (match por NCM + descrição similar via `pg_trgm`), quantidade, valor.
  - Botão "Cadastrar novo produto" se não houver match.
  - Botão "Vincular a SKU existente".
- **Conciliação:** conta contábil, centro de custo (futuro).
- **Ações:** confirmar (grava como `nota_fiscal` e dispara estoque) | descartar (status='descartado', mantém XML 5 anos).

## Padrões e ressalvas

- **`fast-xml-parser` com `preserveOrder: true`** — para auditoria fiel do XML recebido.
- **Validar assinatura ANTES** de qualquer parsing de dados — XML não-assinado nunca entra no sistema.
- **Idempotência por chave_acesso** — uploads duplicados retornam o ID original sem reprocessar.
- **XML sempre permanece no S3** com Object Lock 6 anos, mesmo se descartado pela revisão. Compliance fiscal não conhece "descarte".
- **Stream para arquivos grandes** — XML pode ter MB em casos com muitos itens. Não carregue em string em memória.
- **Detecção de NCM divergente:** se o produto cadastrado tem NCM diferente do XML, alertar (pode ser fraude tributária).
- **`zip`** — extrair antes; processar individualmente. Limitar arquivos por zip (anti-zip-bomb).

## Bibliotecas

| Pacote | Versão | Papel |
|--------|--------|-------|
| `fast-xml-parser` | 4.5+ | Parse |
| `xml-crypto` | 6.x | Validação de assinatura |
| `node-forge` | 1.3+ | Cadeia ICP-Brasil |
| `unzipper` ou `adm-zip` | latest | Extração ZIP |
| `bullmq` | 5.x | Fila |

## Próximos passos

- [ ] Modelo `ImportXml` + migration
- [ ] Página `(app)/importar/page.tsx` com Dropzone (componente shadcn)
- [ ] Endpoint multipart upload + S3
- [ ] Worker `parse-import-xml` (validar assinatura → extrair → match)
- [ ] Tela de revisão com tabela editável
- [ ] **Distribuição DFe** (Fase 3) — manifestação automática usando `.pfx` do tenant
- [ ] Inbox de e-mail (Fase 3) — domínio `xml.nexofiscal.com.br` + AWS SES inbound
- [ ] Reconciliação contábil (lançamento automático em conta sugerida)
