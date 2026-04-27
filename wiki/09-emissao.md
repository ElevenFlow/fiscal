# 09 — Emissão (NFS-e / NF-e / devolução)

## Visão geral

Emissão de documentos fiscais — **rotina mais crítica do produto** (core value: emitir em < 1 minuto).

Três tipos:
- **NFS-e** — Nota Fiscal de Serviço Eletrônica (municipal). Padrão Nacional NFS-e está obrigatório desde 2026-01.
- **NF-e** — Nota Fiscal Eletrônica (estadual, mercadoria).
- **Devolução** — variação de NF-e com finalidade `4` (devolução).

## Status atual

**Scaffolded.** Páginas placeholder; aviso "Tela maior necessária" (FOUND-16) em mobile.

| Componente | Status |
|-----------|--------|
| Páginas de formulário | Placeholder (sem campos reais) |
| `package fiscal-gateway` | Planejado |
| Integração Focus NFe (NF-e) | Planejado |
| Integração Focus NFe / PlugNotas (NFS-e) | Planejado |
| Job BullMQ `emit-nfe`, `emit-nfse` | Planejado |
| Polling/SSE de status | Planejado |

## Decisão arquitetural — Build vs Buy

### MVP: Buy (Focus NFe + PlugNotas)

**Razão:** o ponto #1 de falha em projetos fiscais BR é a assinatura **XMLDSig com C14N quebrado** → rejeição SEFAZ 297 ("Assinatura difere da calculada"). Comprar elimina esse risco.

| Gateway | Cobertura | Preço | Papel |
|---------|-----------|-------|-------|
| **[Focus NFe](https://focusnfe.com.br/doc/)** | NF-e + 1.400+ municípios NFS-e | ~R$ 0,08–0,50/doc + R$ 199 flat para nova prefeitura | Primário |
| **[PlugNotas](https://plugnotas.com.br/)** | 1.600+ cidades NFS-e | tabela própria | Contingência |
| **[Nuvem Fiscal](https://www.nuvemfiscal.com.br/)** | Alternativa | — | Avaliar pós-MVP |

### Fase 2+: Build (NFeWizard-io + xml-crypto)

Internalizar **só NF-e** primeiro (o protocolo é nacional e estável). NFS-e fica no gateway por causa da explosão de variações municipais.

Bibliotecas-alvo:
- [`NFeWizard-io`](https://github.com/nfewizard-org/nfewizard-io) — orquestração (requer JDK 11+ no servidor)
- [`xml-crypto@6.x`](https://github.com/node-saml/xml-crypto) — assinatura XMLDSig
- [`xmlbuilder2`](https://www.npmjs.com/package/xmlbuilder2) — geração XML
- [`node-forge`](https://www.npmjs.com/package/node-forge) — extração da chave do .pfx
- [`soap`](https://www.npmjs.com/package/soap) ou `strong-soap` — cliente SOAP SEFAZ

> ⚠️ Ao internalizar, configure **explicitamente**:
> ```ts
> canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
> signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
> ```
> e teste contra os XMLs de homologação do Manual antes de qualquer cliente real.

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/emitir/page.tsx` — hub
- `src/app/(app)/emitir/nfs-e/page.tsx` — formulário NFS-e
- `src/app/(app)/emitir/nf-e/page.tsx` — formulário NF-e
- `src/app/(app)/emitir/devolucao/page.tsx` — formulário devolução

### Backend (planejado)
- `apps/api/src/modules/emissao/emissao.module.ts`
- `apps/api/src/modules/emissao/emissao.controller.ts`
- `apps/api/src/modules/emissao/emissao.service.ts`
- `apps/api/src/jobs/emit-nfe.processor.ts` — worker BullMQ
- `apps/api/src/jobs/emit-nfse.processor.ts`

### Package
- `packages/fiscal-gateway/src/index.ts` — porta + adapters
- `packages/fiscal-gateway/src/adapters/focus-nfe.adapter.ts`
- `packages/fiscal-gateway/src/adapters/plugnotas.adapter.ts`

### Shared
- `packages/shared/src/emissao/nfe.schema.ts`
- `packages/shared/src/emissao/nfse.schema.ts`

## Fluxo de emissão

```
┌────────────────────────────────────────────────────────────────────┐
│  1. Usuário preenche form (React Hook Form + Zod)                  │
└────────────────────┬───────────────────────────────────────────────┘
                     │  POST /api/notas/emitir
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  2. NestJS valida DTO (mesmo Zod compartilhado)                    │
│     • Cria NotaFiscal status='rascunho'                            │
│     • Enfileira job BullMQ                                         │
│     • Retorna 202 Accepted { notaId }                              │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  3. Worker BullMQ pega job                                         │
│     • Resolve gateway (Focus NFe primário, PlugNotas fallback)     │
│     • Carrega .pfx do tenant (S3 → KMS decrypt → memory cache)     │
│     • Monta payload conforme schema do gateway                     │
│     • Envia                                                        │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  4. Gateway responde                                               │
│     • Sucesso: salva XML autorizado no S3 (Object Lock 6 anos)     │
│       Atualiza NotaFiscal status='autorizada'                      │
│       Insert NotaFiscalEvento('autorizada')                        │
│     • Denegada: status='denegada' + motivo + alerta                │
│     • Erro transient (timeout): retry exponencial (BullMQ)         │
│     • Erro 4xx do gateway: status='rejeitada' + alert              │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  5. Frontend descobre via SSE/polling                              │
│     • Polling: GET /api/notas/{id} a cada 2s                       │
│     • SSE (futuro): /api/notas/stream                              │
└────────────────────────────────────────────────────────────────────┘
```

## Padrão de adapter (porta + adapter)

```ts
// packages/fiscal-gateway/src/index.ts
export interface FiscalGateway {
  emitNfe(input: EmitNfeInput, cert: A1Cert): Promise<EmitNfeOutput>;
  emitNfse(input: EmitNfseInput, cert: A1Cert): Promise<EmitNfseOutput>;
  cancelNfe(chaveAcesso: string, justificativa: string, cert: A1Cert): Promise<CancelOutput>;
  // ...
}

// packages/fiscal-gateway/src/adapters/focus-nfe.adapter.ts
export class FocusNfeAdapter implements FiscalGateway {
  constructor(private readonly client: AxiosInstance, private readonly token: string) {}
  async emitNfe(input, cert) {
    const response = await this.client.post('/v2/nfe', mapToFocusPayload(input), {
      headers: { Authorization: `Token token=${this.token}` },
    });
    return mapFromFocus(response.data);
  }
}
```

Service escolhe adapter por configuração (`FISCAL_GATEWAY_PRIMARY=focus_nfe`) e cai para fallback em erro `5xx`.

## Validações críticas (Zod)

```ts
const NfeEmitSchema = z.object({
  emitenteCnpj: z.string().refine(isValidCnpj),
  destinatario: z.object({
    cpfCnpj: z.string(),
    razaoSocial: z.string().min(2).max(60),
    endereco: enderecoSchema,
  }),
  itens: z.array(z.object({
    produtoId: z.string().uuid(),
    quantidade: z.number().positive(),
    valorUnitario: z.number().positive(),
    cfop: z.string().length(4),
    ncm: z.string().length(8),
    cest: z.string().length(7).optional(),
    // ...
  })).min(1).max(990),  // limite NF-e
  natureza: z.string().max(60),
  finalidade: z.enum(['1', '2', '3', '4']),  // 4 = devolução
  // ...
});
```

## Padrões e ressalvas

- **Timezone:** `dhEmi` em `America/Sao_Paulo` (`-03:00`). NUNCA UTC. Cancelamento 24h é contado em horário local.
- **Não logue payload bruto** — pode conter CPF do destinatário pessoa física. Pino redact + safeLog.
- **`.pfx` em memória, não disco.** Worker carrega do S3 → cifrado → KMS decrypt → buffer → cache TTL 30 min em memória do worker. Nunca grava em filesystem.
- **Cold start kills emissão.** Workers em ECS Fargate sempre quentes (min 1 task). Serverless OK para read-only.
- **Idempotência:** cliente envia `Idempotency-Key`; backend dedupa por (tenantId + key) por 24h em Redis.
- **Contingência SEFAZ:** circuit breaker por UF; quando aberto, fila aceita jobs e retoma quando fecha.
- **DANFE:** usar [`brasil-js/danfe`](https://github.com/brasil-js/danfe) para gerar PDF a partir do XML autorizado. Não dependa do PDF do gateway.
- **DANFSE:** layout varia por município → renderização HTML→PDF com Puppeteer (`puppeteer-core` + `@sparticuz/chromium` em serverless).

## Mapeamentos críticos (NF-e)

| Campo NF-e | Notas |
|-----------|-------|
| `cUF` | Código IBGE da UF emitente |
| `cNF` | 8 dígitos aleatórios (NÃO sequencial) |
| `mod` | `55` (NF-e), `65` (NFC-e) |
| `serie` | configurável por empresa |
| `nNF` | sequencial por série, sem buracos |
| `tpEmis` | `1` normal, `9` contingência off-line |
| `cDV` | dígito verificador da chave |
| `chave` | 44 chars: cUF + AAMM + CNPJ + mod + serie + nNF + tpEmis + cNF + cDV |

## Bibliotecas

| Pacote | Versão | Papel | Quando |
|--------|--------|-------|--------|
| `axios` | latest | HTTP gateway | MVP |
| `zod` | 3.x | Validação form/DTO | MVP |
| `bullmq` | 5.x | Fila + retry | MVP |
| `nfe-wizard-io` | latest | Orquestração interna | Fase 2+ |
| `xml-crypto` | 6.x | Assinatura XMLDSig | Fase 2+ |
| `xmlbuilder2` | 3.x | Geração XML | Fase 2+ |
| `node-forge` | 1.3+ | .pfx parser | Fase 2+ |
| `soap` ou `strong-soap` | 1.x | SOAP SEFAZ | Fase 2+ |
| `puppeteer-core` + `@sparticuz/chromium` | latest | DANFSE PDF | Fase 2 |
| `@brasil-js/danfe` | latest | DANFE PDF | Fase 2 |

## Próximos passos

- [ ] Pesquisa: 3-way POC homologação Focus NFe vs PlugNotas vs Nuvem Fiscal
- [ ] `package fiscal-gateway` com porta + 2 adapters
- [ ] Cofre de certificado (envelope KMS) — pré-requisito de [14-configuracoes.md](14-configuracoes.md)
- [ ] Worker BullMQ `emit-nfe` + circuit breaker por UF
- [ ] Form NFS-e em `apps/web` (responsivo desktop-first; mobile bloqueado)
- [ ] DANFE/DANFSE renderer
- [ ] Cancelamento NF-e (janela 24h) + CC-e (720h)
- [ ] Tests E2E em homologação (Playwright)
