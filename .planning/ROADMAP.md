# Nexo Fiscal — Roadmap

**Version:** v1 (MVP)
**Granularity:** standard (7 fases)
**Coverage:** 88/88 requisitos mapeados
**Generated:** 2026-04-17 by gsd-roadmapper

---

## Phases

- [x] **Phase 1: Foundation — Multi-tenant, Auth, RLS, Audit, UI Shell** — Fundação de segurança, isolamento cross-tenant, auditoria imutável e shell visual do produto
- [x] **Phase 2: Cadastros + Certificado A1 + Séries** — CRUDs fiscais, pipeline KMS do certificado digital e gestão de séries com ambiente por série
- [x] **Phase 02.1: Auth In-House — Foundation** — Autenticação própria JWT HS256 + argon2id + sessions, substituindo Clerk
- [x] **Phase 3: SEFAZ-SC Direto + Emissão NF-e 55** — Integração direta com webservices SEFAZ-SC, assinatura XMLDSig, fila assíncrona, emissão NF-e E2E, DANFE, cancelamento e tratamento de rejeições
- [x] **Phase 4: Emissão NFS-e + Nota de Devolução** — Base operacional de NFS-e orientada a Santa Catarina, sem integração municipal real neste momento, e nota de devolução vinculada com CFOP inverso
- [x] **Phase 5: Importação XML + Estoque** — Upload seguro de XML de compra, matching de produtos, event sourcing de movimentações e alertas de estoque
- [x] **Phase 6: Documentos + Alertas + Dashboards (Diferencial)** — Consulta unificada, Central de Alertas e os três dashboards, incluindo a carteira consolidada da contabilidade
- [ ] **Phase 7: Configurações + Usuários + Hardening** — Configurações da empresa, gestão de usuários/perfis, auditoria na UI e hardening pré-GA

---

## Phase Details

### Phase 1: Foundation — Multi-tenant, Auth, RLS, Audit, UI Shell
**Goal**: Estabelecer malha de segurança, isolamento multi-tenant rígido, auditoria imutável e shell visual premium antes de qualquer funcionalidade fiscal.
**Depends on**: Nada (primeira fase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11, FOUND-12, FOUND-13, FOUND-14, FOUND-15, FOUND-16
**Success Criteria** (o que deve ser VERDADE ao final):
  1. Um usuário de Contabilidade A não consegue ver nenhum dado de Contabilidade B nem de empresa fora da sua carteira (teste de regressão anti-leak passa em CI)
  2. Usuário consegue se cadastrar, fazer login, manter-se conectado, recuperar senha por e-mail e deslogar de qualquer página
  3. Toda ação crítica (login, convite, mudança de permissão) gera registro imutável em `audit_log` que não pode ser editado nem deletado (trigger `BEFORE UPDATE/DELETE` rejeita)
  4. Aplicação carrega com shell completo — sidebar colapsável 240px→64px, header com seletor de empresa ativa, busca Ctrl+K, sino de alertas, paleta azul/verde/cinza e tipografia Inter + mono — em desktop, tablet e mobile (mobile prioriza consulta/alertas)
  5. Arquivos fiscais e logs não expõem PII: Pino redige senha/CPF/CNPJ/bytes de certificado automaticamente e S3 Object Lock Compliance Mode está ativo com retenção de 6 anos
**Plans**: 10 plans
**Plan list**:
- [ ] 01-01-PLAN.md — Monorepo pnpm + Turborepo + TypeScript strict + Biome (wave 1)
- [ ] 01-02-PLAN.md — Docker Compose Postgres 16 local + roles app_user/app_admin (wave 1)
- [ ] 01-03-PLAN.md — Design system @nexo/ui (paleta azul/verde + Inter/Mono + componentes shadcn + Money/StatusPill) (wave 1)
- [ ] 01-04-PLAN.md — Schema Prisma + RLS forçado + audit_log particionado imutável + suite regressão RLS (wave 2)
- [ ] 01-05-PLAN.md — API NestJS 11 + Fastify + Pino redact PII + guards RBAC/Audit/Tenants (wave 2)
- [ ] 01-06-PLAN.md — Web shell Next.js 15 — sidebar 240px colapsável + header Ctrl+K + rotas placeholder (wave 2)
- [ ] 01-07-PLAN.md — Clerk Organizations (login/cadastro/recuperação/convite/RBAC) + webhook + API JWT (wave 3)
- [ ] 01-08-PLAN.md — S3 Object Lock 6 anos + OPS_README (FOUND-11) (wave 3)
- [ ] 01-09-PLAN.md — Portal LGPD (FOUND-12) — apps/api endpoints + Next.js route handler proxy + páginas (wave 3)
- [ ] 01-10-PLAN.md — Observability scaffold (Sentry + OpenTelemetry no-op) + docs/OBSERVABILITY.md (wave 3, sem requirements)
**UI hint**: yes
**Research flag**: no

### Phase 2: Cadastros + Certificado A1 + Séries
**Goal**: Entregar todos os cadastros de domínio (empresa, contabilidade, clientes, fornecedores, produtos, serviços) e o pipeline KMS do certificado digital A1, pré-condição irreversível para qualquer emissão fiscal.
**Depends on**: Phase 1
**Requirements**: CAD-01, CAD-02, CAD-03, CAD-04, CAD-05, CAD-06, CAD-07, CAD-08, CAD-09, CAD-10, CAD-11, CERT-01, CERT-02, CERT-03, CERT-04, CERT-05, CERT-06, CERT-07, CERT-08
**Success Criteria** (o que deve ser VERDADE ao final):
  1. Empresa consegue cadastrar e editar Contabilidades, Empresas, Clientes PF/PJ, Fornecedores, Produtos (NCM/CEST/CFOP/CST) e Serviços (LC 116) com autopreenchimento via CNPJ público + ViaCEP e validação de CPF/CNPJ em tempo real
  2. Empresa faz upload de certificado A1 .pfx, o sistema cifra via KMS envelope encryption (encryption context `{tenantId, purpose:'pfx'}`) antes de persistir e exibe CN/CNPJ/validade/fingerprint do certificado
  3. Alerta de certificado vencendo aparece escalonado em D-60 / D-30 / D-15 / D-7 / D-0 tanto para a empresa quanto para a contabilidade responsável, e em D-0 a emissão fica bloqueada com ação clara "renovar"
  4. Empresa consegue criar séries fiscais por modelo (NF-e 55, NFS-e) com ambiente Produção/Homologação **por série** — banner amarelo persistente "AMBIENTE DE HOMOLOGAÇÃO" aparece quando a série ativa está em homologação
  5. Listagens de cadastros oferecem busca livre, filtros, paginação, ações em lote e alertam duplicidade de CPF/CNPJ por tenant ao salvar; worker mensal mantém NCM/CEST/CFOP/códigos LC 116 atualizados
**Plans**: 9 plans
**Plan list**:
- [x] 02-01-PLAN.md — Schema Prisma + 4 migrations + RLS Phase 2 + suite anti-leak (wave 1)
- [x] 02-09-PLAN.md — Reativação Clerk Organizations + middleware + páginas + webhook (wave 1)
- [x] 02-02-PLAN.md — 6 CRUDs NestJS + schemas Zod compartilhados + audit + RBAC (wave 2)
- [x] 02-04-PLAN.md — Pipeline KMS .pfx + parse node-forge + S3 cert bucket + endpoints REST (wave 2)
- [x] 02-06-PLAN.md — CRUD séries fiscais + numeração transacional + banner homologação + guard ambiente (wave 2)
- [x] 02-03-PLAN.md — Validação CPF/CNPJ + duplicidade + integrações BrasilAPI/ViaCEP cacheadas (wave 3)
- [x] 02-05-PLAN.md — BullMQ cron alertas certificado D-60..D-0 + Redis docker + endpoint REST (wave 3)
- [x] 02-07-PLAN.md — Migração UI mocks → API real (TanStack Query + RHF + autofills + cert/series UI) (wave 4)
- [x] 02-08-PLAN.md — Worker mensal NCM/CEST/CFOP/LC116 + autocomplete trgm + fixtures bootstrap (wave 4)
**UI hint**: yes
**Research flag**: no

### Phase 02.1: Auth In-House — Foundation (INSERTED)

**Goal:** Substituir Clerk Organizations por autenticação própria (argon2id + JWT HS256 + cookie HttpOnly) para eliminar dependência externa e desbloquear desenvolvimento solo. Entrega: AuthGuard NestJS, AuthController (signup/signin/signout/refresh/me), middleware custom Next.js, páginas /entrar e /cadastrar com RHF+Zod, remoção total de @clerk/* e seed do 1º admin.
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Depends on:** Phase 2
**Plans:** 4/4 plans complete

Plans:
- [x] 02.1-01-PLAN.md — DB migration: users.password_hash + emailVerifiedAt + sessions table + drop clerkUserId + @nexo/shared/auth schemas Zod (wave 1)
- [x] 02.1-02-PLAN.md — NestJS AuthModule: PasswordService (argon2id) + JwtService (jose) + SessionsService + AuthGuard + AuthController + testes (wave 2)
- [x] 02.1-03-PLAN.md — apps/web: middleware custom cookie JWT + páginas /entrar /cadastrar + Route Handlers proxy + api-client swap + remoção ClerkProvider (wave 2)
- [x] 02.1-04-PLAN.md — Cleanup: uninstall @clerk/* + limpar .env.example + seed 1º admin + docs/AUTH.md + wiki + CI grep test (wave 3)

### Phase 3: SEFAZ-SC Direto + Emissão NF-e 55
**Goal**: Entregar a espinha dorsal fiscal com integração direta aos webservices da SEFAZ-SC — geração e validação XML NF-e 4.00, assinatura XMLDSig com certificado A1, comunicação SOAP/mTLS, fila assíncrona, máquina de estados de emissão, idempotência, DANFE, cancelamento e tratamento amigável de rejeições.
**Depends on**: Phase 1, Phase 2
**Requirements**: EMIT-02, EMIT-04, EMIT-05, EMIT-06, EMIT-07, EMIT-08, EMIT-09, EMIT-10, EMIT-11, EMIT-12, EMIT-13, EMIT-14, EMIT-15
**Success Criteria** (o que deve ser VERDADE ao final):
  1. Empresa consegue emitir NF-e modelo 55 em homologação contra SEFAZ-SC, com XML assinado validado por XSD, protocolo de autorização persistido e DANFE + XML autorizado disponíveis para download.
  2. A integração direta com SEFAZ-SC usa certificado A1 decifrado apenas em memória no worker, assinatura XMLDSig com C14N explícito, SOAP/mTLS, WSDL/endpoints versionados e testes de conformidade contra XMLs de referência.
  3. Retries de transmissão nunca geram rejeição 539 — toda emissão persiste idempotency key antes do envio, consulta status (`NfeConsultaProtocolo`) antes de qualquer retry e segue a máquina de estados `DRAFT → SIGNING → TRANSMITTING → PENDING_RESPONSE → AUTHORIZED/REJECTED/CANCELLED`.
  4. Empresa consegue cancelar nota dentro de 24h com motivo ≥ 15 caracteres, corrigir e retransmitir notas rejeitadas reaproveitando o rascunho, e ver cada código SEFAZ traduzido em linguagem humana com ação sugerida.
  5. Quando SEFAZ-SC fica indisponível, o circuit breaker isola a falha, UI mostra o estado, emissões ficam em fila e voltam automaticamente; a lógica SOAP/XMLDSig fica encapsulada no adapter `SefazScGateway`, sem vazar para domínio, controllers ou UI.
**Plans**: 4 subfases — concluídas em 2026-04-27; validação técnica refeita em 2026-04-29
**Subphase list**:
- [x] **03.1 — Fundação SEFAZ-SC + Domínio NF-e**: schema `NotaFiscal`/eventos, RLS, tipos compartilhados, `FiscalGateway`, `SefazScGateway` stub e endpoints iniciais.
- [x] **03.2 — XML NF-e 4.00 + Assinatura A1 + SOAP/mTLS**: builder XML, extração PFX, XMLDSig/C14N, SOAP 1.2/mTLS base e endpoints SVRS/SC.
- [x] **03.3 — Worker de Emissão + Autorização/Consulta/Cancelamento**: BullMQ/fallback inline, máquina de estados, reserva de numeração, retry com consulta prévia e cancelamento.
- [x] **03.4 — Documentos, UI Operacional + Homologação**: XML/DANFE sob demanda, armazenamento S3 quando disponível, proxies Next.js, tela `/emitir/nf-e` e painel `/documentos`.
**UI hint**: yes
**Research flag**: resolved para implementação base. Pendência operacional: homologação real SEFAZ-SC/SVRS com certificado A1 ativo, material mTLS seguro no worker e migrations aplicadas no banco alvo. DANFE ainda é mínimo.

### Phase 4: Emissão NFS-e + Nota de Devolução
**Goal**: Reaproveitar a arquitetura de fila + gateway da Fase 3 para preparar a base operacional de NFS-e orientada a Santa Catarina, sem integração municipal real neste momento, e entregar Nota de Devolução vinculada a NF-e de origem com CFOP inverso.
**Depends on**: Phase 3
**Requirements**: EMIT-01, EMIT-03
**Success Criteria** (o que deve ser VERDADE ao final):
  1. Empresa consegue criar e acompanhar rascunhos de NFS-e com tomador, serviço, tributação, retenções, série e município, usando fluxo interno/simulado sem transmissão municipal real.
  2. A base de NFS-e fica preparada para plugar adapters municipais de Santa Catarina quando o primeiro cliente definir município, credenciais e ambiente real.
  3. Empresa consegue emitir Nota de Devolução vinculada a uma NF-e de origem autorizada, selecionando itens a devolver, informando motivo obrigatório e gerando automaticamente CFOP inverso e referência `refNFe`.
  4. Timeline, status, XML/PDF internos e mensagens operacionais ficam padronizados para NFS-e/devolução, reaproveitando a infraestrutura da Fase 3.
**Plans**: 1 plano — concluído em 2026-04-29
**UI hint**: yes
**Research flag**: yes — modelagem NFS-e para Santa Catarina sem integração municipal real; mapear dados mínimos e deixar adapters municipais para quando houver primeiro cliente.
**Delivered**: `04-01-SUMMARY.md` — contratos compartilhados `NFSE`/`DEVOLUCAO`, rotas API/proxies Next, telas `/emitir/nfs-e` e `/emitir/devolucao` conectadas a rascunhos reais e autorização interna.
**Next planning note**: integração municipal real continua fora do escopo e deve ser retomada apenas com primeiro cliente em Santa Catarina.

### Phase 5: Importação XML + Estoque
**Goal**: Implementar o gancho de retenção do produto — upload seguro de XML de compra, matching de produtos com revisão humana, event sourcing de movimentações de estoque e alertas de estoque mínimo.
**Depends on**: Phase 2, Phase 3
**Requirements**: STOCK-01, STOCK-02, STOCK-03, STOCK-04, STOCK-05, STOCK-06, STOCK-07, STOCK-08, STOCK-09, STOCK-10, STOCK-11, STOCK-12, STOCK-13, STOCK-14
**Success Criteria** (o que deve ser VERDADE ao final):
  1. Empresa consegue arrastar múltiplos XMLs de compra (até 10 simultâneos, 10 MB cada) e cada XML é parseado com `fast-xml-parser` configurado com `processEntities: false` + pre-scan que rejeita `<!DOCTYPE`/`<!ENTITY`/`SYSTEM`/`PUBLIC` (XXE bloqueado) num worker sem egress (SSRF bloqueado)
  2. XML já importado por chave de acesso é detectado e o sistema informa "XML já importado em DATA" ao invés de duplicar; tela de revisão mostra matching automático (NCM + descrição + unidade) permitindo vincular, criar novo produto ou ignorar cada item antes de confirmar
  3. Confirmação da importação cria/atualiza produtos e registra movimentações em `movimentacoes_estoque` via event sourcing — duas operações concorrentes no mesmo SKU respeitam lock pessimista (`SELECT FOR UPDATE`) e nunca geram saldo inconsistente
  4. Empresa consegue registrar movimentações manuais (entrada, saída, ajuste) com motivo obrigatório, filtrar movimentações por produto/tipo/período/origem e ver o saldo após cada operação; posição atual vem de view materializada com alerta visual abaixo do mínimo
  5. Empresa consegue desfazer uma importação em até 24h após a confirmação (reverte todas as movimentações daquele lote) e um job noturno reconcilia saldos calculados vs movimentações e alerta inconsistências
**Plans**: 1 plano — concluído em 2026-04-29
**UI hint**: yes
**Research flag**: resolved para base técnica. Pendências operacionais: worker isolado sem egress, validação XSD completa, materialized view de saldo, undo em 24h e jobs de alertas/reconciliação.
**Delivered**: `05-01-SUMMARY.md` — schema/RLS de importação e movimentações, parser seguro `fast-xml-parser`, API/proxies Next, telas `/importar`, `/importar/revisar/[id]` e `/estoque` conectadas a dados reais.

### Phase 6: Documentos + Alertas + Dashboards (Diferencial)
**Goal**: Entregar a tese competitiva do Nexo Fiscal — consulta unificada de documentos, Central de Alertas inteligente e os três dashboards (Admin, Contabilidade com carteira consolidada, Empresa) onde o diferencial Contador↔Empresa se materializa.
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, DOCS-07, DOCS-08, ALERT-01, ALERT-02, ALERT-03, ALERT-04, ALERT-05, ALERT-06, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (o que deve ser VERDADE ao final):
  1. Empresa e contabilidade conseguem listar NFS-e, NF-e e Devoluções numa tela unificada com tabs + filtros (tipo, status em pills coloridas, período, cliente, faixa de valor), ver timeline de eventos de cada documento, baixar PDF/XML individualmente ou em lote (ZIP + CSV) e enviar por e-mail
  2. Contabilidade abre o Dashboard Contabilidade e enxerga **a carteira consolidada** — KPIs (empresas, notas hoje, pendências ativas, certificados vencendo), seção "Empresas que precisam de atenção" com pills de alerta por empresa e gráfico das top 10 empresas em emissões no mês — atendendo budget de 2s via materialized views
  3. Empresa consegue ver seu próprio dashboard com KPIs (notas do mês, faturamento, rejeitadas pendentes, estoque crítico), ações rápidas (+NFS-e / +NF-e / Importar XML), gráfico de faturamento 6 meses e últimas notas
  4. Central de Alertas lista alertas por severidade (🔴 Crítico / 🟠 Atenção / 🔵 Informativo) com filtros, ação rápida contextual e botão "Marcar como resolvido"; alertas idênticos numa janela de 24h são deduplicados; sino do header mostra badge com contagem de críticos não-resolvidos
  5. Contabilidade e Empresa veem eventos em tempo real via SSE com indicador "novo desde sua última visita" e Dashboard Admin mostra KPIs globais da plataforma com tabela de atividade recente
**Plans**: 1 plano — concluído em 2026-04-29
**UI hint**: yes
**Research flag**: resolved para base operacional. Pendências operacionais: SSE por tenant, ZIP/XML/PDF em lote com e-mail, resolução persistente/deduplicação de alertas e materialized views de KPIs.
**Delivered**: `06-01-SUMMARY.md` — contratos `operacional`, rotas API/proxies Next, tela `/documentos`, Central de Alertas, dashboards por perfil e sino do header com badge real.
**Next planning note**: Phase 7 deve decidir quais pendências de hardening entram junto com configurações, usuários e auditoria na UI.

### Phase 7: Configurações + Usuários + Hardening
**Goal**: Fechar o produto com a tela de Configurações da Empresa, gestão de usuários e permissões, visualização de auditoria na UI e hardening de produção (pentesting, load test, runbooks) pronto para GA.
**Depends on**: Phase 6
**Requirements**: CFG-01, CFG-02, CFG-03, CFG-04, CFG-05
**Success Criteria** (o que deve ser VERDADE ao final):
  1. Empresa abre Configurações e navega entre seções (Dados, Certificado, Séries, Integrações, E-mails, Preferências, Plano, Usuários) mantendo contexto visual
  2. Empresa consegue configurar templates de e-mail de envio de nota (assunto, corpo, remetente, cc padrão) por empresa e ver o resultado aplicado na próxima emissão
  3. Admin/Contabilidade consegue gerenciar usuários (criar, editar, desativar, bloquear, reenviar convite, redefinir senha) e atribuir perfis; perfis padrão (Admin, Contador Master, Operador Empresa, Visualizador) são não-editáveis, mas permissões customizáveis por célula (Visualizar/Criar/Editar/Excluir/Emitir × módulo) funcionam
  4. Qualquer usuário autorizado consegue abrir os logs de auditoria pela UI com filtros (usuário, tipo de ação, entidade, período, IP, resultado) e expandir o diff antes/depois de cada alteração crítica
**Plans**: TBD
**UI hint**: yes
**Research flag**: no

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Multi-tenant, Auth, RLS, Audit, UI Shell | 10/10 | Complete | 2026-04-24 |
| 2. Cadastros + Certificado A1 + Séries | 9/9 | Complete | 2026-04-26 |
| 02.1. Auth In-House — Foundation | 4/4 | Complete | 2026-04-27 |
| 3. SEFAZ-SC Direto + Emissão NF-e 55 | 4/4 subfases | Complete técnico/base; homologação real pendente | 2026-04-27 |
| 4. Emissão NFS-e + Nota de Devolução | 1/1 | Complete técnico/base; integração municipal real pendente | 2026-04-29 |
| 5. Importação XML + Estoque | 1/1 | Complete técnico/base; jobs e undo pendentes | 2026-04-29 |
| 6. Documentos + Alertas + Dashboards (Diferencial) | 1/1 | Complete técnico/base; SSE, ZIP/e-mail e materialized views pendentes | 2026-04-29 |
| 7. Configurações + Usuários + Hardening | 0/TBD | Next | - |

---

## Coverage Summary

**Total v1 requirements:** 88
**Mapped:** 88
**Orphaned:** 0

| Category | Count | Phase(s) |
|----------|-------|----------|
| FOUND (Foundation) | 16 | Phase 1 + Phase 02.1 (FOUND-01..04) |
| CAD (Cadastros) | 11 | Phase 2 |
| CERT (Certificado + Séries) | 8 | Phase 2 |
| EMIT (Emissão Fiscal) | 15 | Phase 3 (13) + Phase 4 (2) |
| STOCK (Importação XML + Estoque) | 14 | Phase 5 |
| DOCS (Documentos) | 8 | Phase 6 |
| ALERT (Alertas) | 6 | Phase 6 |
| DASH (Dashboards) | 5 | Phase 6 |
| CFG (Configurações) | 5 | Phase 7 |

---

*Last updated: 2026-04-29 by Codex execution (Phase 6 base completed; Phase 7 next)*
