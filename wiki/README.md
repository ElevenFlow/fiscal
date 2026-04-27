# Wiki — Nexo Fiscal

Documentação interna de desenvolvimento das rotinas do **Nexo Fiscal** — plataforma SaaS multiempresa brasileira para emissão de notas fiscais (NFS-e, NF-e, devolução), importação automática de XML, controle de estoque e auditoria.

> **Idioma:** todos os documentos são em **português-BR**, alinhados com o público-alvo (contabilidades + empresas brasileiras) e com a regra do projeto (`CLAUDE.md`).

---

## Como usar esta wiki

1. **Para entender a arquitetura** → comece em [00-arquitetura-geral.md](00-arquitetura-geral.md).
2. **Para uma rotina específica** → leia o arquivo numerado correspondente (01–16).
3. **Para o modelo de dados** → consulte [99-banco-de-dados.md](99-banco-de-dados.md).
4. **Para padrões de código** (RLS, Server Actions, BullMQ etc.) → veja [99-padroes-desenvolvimento.md](99-padroes-desenvolvimento.md).

Cada arquivo de rotina segue a mesma estrutura:
- **Visão geral** — o que a rotina faz e por quê
- **Status atual** — *complete | partial | scaffolded | planejado*
- **Arquivos envolvidos** — frontend, backend, packages, prisma
- **API & endpoints** — rotas, métodos, payloads
- **Modelo de dados** — tabelas e campos relevantes
- **Fluxo de desenvolvimento** — passo a passo para evoluir a rotina
- **Bibliotecas e APIs externas** — versões, motivações, links oficiais
- **Padrões e ressalvas** — RLS, auditoria, LGPD, *pitfalls*
- **Próximos passos / TODO** — o que falta para completar

---

## Índice

### Arquitetura e fundamentos
| # | Documento | Status |
|---|-----------|--------|
| 00 | [Arquitetura geral](00-arquitetura-geral.md) | — |
| 99a | [Banco de dados (referência)](99-banco-de-dados.md) | — |
| 99b | [Padrões de desenvolvimento](99-padroes-desenvolvimento.md) | — |

### Rotinas de fundação (foundation)
| # | Rotina | Status |
|---|--------|--------|
| 01 | [Autenticação (Clerk)](01-autenticacao.md) | Complete |
| 02 | [Multi-tenancy & RBAC](02-multi-tenancy-rbac.md) | Complete |
| 03 | [Auditoria (audit log)](03-auditoria.md) | Complete (backend) |
| 04 | [Armazenamento S3 + Object Lock](04-armazenamento-s3.md) | Complete |
| 05 | [Portal LGPD do titular](05-lgpd-portal.md) | Complete |
| 16 | [Observabilidade (Sentry + OTel)](16-observabilidade.md) | Complete |

### Rotinas de produto (scaffolded → a implementar)
| # | Rotina | Status |
|---|--------|--------|
| 06 | [Dashboard (visão geral)](06-dashboard.md) | Scaffolded |
| 07 | [Cadastros (master data)](07-cadastros.md) | Scaffolded |
| 08 | [Documentos](08-documentos.md) | Scaffolded |
| 09 | [Emissão (NFS-e / NF-e / devolução)](09-emissao.md) | Scaffolded |
| 10 | [Importação de XML de compra](10-importacao-xml.md) | Scaffolded |
| 11 | [Estoque](11-estoque.md) | Scaffolded |
| 12 | [Alertas](12-alertas.md) | Scaffolded |
| 13 | [Auditoria (visualizador)](13-auditoria-viewer.md) | Scaffolded |
| 14 | [Configurações](14-configuracoes.md) | Scaffolded |
| 15 | [Gerenciamento de usuários](15-usuarios.md) | Scaffolded |

---

## Convenções dos documentos

- **Caminhos de arquivo** são relativos à raiz do monorepo, ex.: `apps/web/src/app/(app)/page.tsx`.
- **Status**:
  - `complete` — implementado, testado e em produção
  - `partial` — parcialmente implementado, faltam pedaços
  - `scaffolded` — apenas placeholder/skeleton, nenhuma lógica de negócio
  - `planejado` — somente especificado em planning, nada ainda no repositório
- **Confiança** das fontes externas:
  - `HIGH` — documentação oficial / código fonte
  - `MEDIUM` — blog/artigo de referência reconhecida
  - `LOW` — manutenção incerta, evitar se possível

---

## Manutenção

A wiki **não é gerada automaticamente**. Quando uma rotina muda:

1. Atualize o documento correspondente.
2. Atualize a tabela de status neste `README.md` se o estado mudou.
3. Se for um padrão novo (ex.: novo tipo de fila, novo gateway), documente em `99-padroes-desenvolvimento.md`.

Em PRs que mudam o comportamento de uma rotina, **inclua a atualização da wiki na mesma PR**.
