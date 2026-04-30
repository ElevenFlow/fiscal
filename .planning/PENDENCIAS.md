# Nexo Fiscal — Pendências Planejadas

**Última atualização:** 2026-04-30

Este arquivo centraliza itens conscientemente deixados para depois durante a execução dos planos. A ideia é evitar que decisões de adiamento fiquem perdidas em `SUMMARY.md` individuais.

## Como Usar

Status sugeridos:
- `Aberta`: pendência reconhecida e ainda não retomada.
- `Planejada`: já entrou em um plano/fase futura.
- `Em execução`: trabalho retomado.
- `Resolvida`: concluída e validada.
- `Cancelada`: decisão explícita de não executar.

Prioridade sugerida:
- `P0`: bloqueia produção ou risco fiscal/segurança crítico.
- `P1`: necessário antes de beta/homologação real.
- `P2`: importante para robustez, operação ou UX.
- `P3`: melhoria futura.

## Pendências Abertas

| ID | Origem | Pendência | Motivo do adiamento | Retomar em | Prioridade | Status |
|---|---|---|---|---|---|---|
| PEND-001 | Phase 3 / 03-01 | Aplicar e validar migration `20260427030000_phase3_nfe_foundation` no banco alvo | A migration foi criada, mas a aplicação local falhou por resolução de env no PowerShell (`$DATABASE_ADMIN_URL` vazio) | Antes da homologação SEFAZ-SC real | P1 | Aberta |
| PEND-002 | Phase 3 / 03-02..03-04 | Executar homologação real SEFAZ-SC/SVRS com certificado A1 ativo | Não havia certificado A1/senha/material mTLS de tenant disponível no runtime | Antes de liberar NF-e para uso real | P0 | Aberta |
| PEND-003 | Phase 3 / 03-03 | Definir entrega segura da senha/material PFX ao worker fiscal em memória | O fluxo atual não persiste senha do PFX; gateway falha fechado com `SEFAZ_SC_CERT_REQUIRED` sem material mTLS | Antes da homologação SEFAZ-SC real | P0 | Aberta |
| PEND-004 | Phase 3 / 03-04 | Substituir DANFE PDF mínimo por DANFE completo baseado no XML autorizado | Entregue representação simples para fechar fluxo técnico; layout fiscal completo ficou fora do escopo da base | Antes de produção | P1 | Aberta |
| PEND-005 | Phase 3 / 03-04 | Validar armazenamento de XML autorizado em S3 Object Lock com bucket real | Código possui caminho S3/fallback, mas validação real depende de infra/env AWS | Antes de produção | P1 | Aberta |
| PEND-006 | Phase 3 | Teste E2E operacional com emissão, download XML/DANFE e cancelamento usando dados reais de homologação | Sem credenciais/certificado/ambiente completo no momento da implementação | Homologação fiscal | P1 | Aberta |
| PEND-007 | Phase 2 / 02-08 | Permitir writes do worker mensal de lookup em produção via `DATABASE_ADMIN_URL` ou contexto admin seguro | Tabelas públicas de lookup tiveram writes revogados para `app_user`; worker precisa estratégia de privilégio controlado | Phase 7 hardening | P2 | Aberta |
| PEND-008 | Phase 2 / 02-08 | Criar endpoint admin `POST /api/lookup/admin/run-sync` para sincronização manual | Cron mensal foi entregue; operação manual foi deferida para hardening/ops | Phase 7 hardening | P3 | Aberta |
| PEND-009 | Phase 2 / 02-08 | Avaliar fontes HTTP estáveis para CEST/CFOP/LC116 | Fixtures foram escolhidas por estabilidade; integração HTTP futura depende de fonte confiável | Pós-MVP ou hardening fiscal | P3 | Aberta |
| PEND-010 | Phase 02.1 / Auth | Adicionar rate limit em endpoints de autenticação | Aceito para MVP solo; necessário para ambiente público | Phase 7.1 / hardening auth | P1 | Aberta |
| PEND-011 | Phase 02.1 / Auth | Adicionar proteção CSRF explícita além de cookie `SameSite=Lax` | Aceito temporariamente para MVP solo | Phase 7.1 / hardening auth | P1 | Aberta |
| PEND-012 | Phase 02.1 / Auth | Endurecer RLS da tabela `sessions` para restringir acesso ao próprio `user_id` | Policy permissiva foi aceita durante fundação auth para acelerar implementação | Phase 7.1 / hardening auth | P1 | Aberta |
| PEND-013 | Phase 4 / NFS-e | Implementar integrações municipais reais de NFS-e em Santa Catarina | Decisão atual: não integrar nenhuma prefeitura agora; a integração será definida pelo primeiro cliente real em SC, município, credenciais e ambiente dele | Pós-primeiro cliente NFS-e em SC | P1 | Aberta |
| PEND-014 | Phase 4 / NFS-e | Pesquisar/adaptar o padrão NFS-e do município catarinense do primeiro cliente | A Fase 4 terá base operacional sem transmissão; o adapter municipal específico de SC só deve ser feito por demanda concreta | Pós-primeiro cliente SC | P2 | Aberta |
| PEND-015 | Phase 5 / Estoque | Aplicar e validar migration `20260429050000_phase5_xml_estoque` no banco alvo | Migration foi criada e buildada, mas não foi aplicada contra banco real nesta execução local | Antes de beta operacional de estoque | P1 | Aberta |
| PEND-016 | Phase 5 / XML | Executar parser de XML em worker isolado sem egress | A base atual parseia de forma segura na API; isolamento de rede do worker depende de infraestrutura/runtime dedicado | Antes de alto volume de importação XML | P1 | Aberta |
| PEND-017 | Phase 5 / XML | Validar XML de compra contra XSD NF-e completo | A Fase 5 implementou validação estrutural e bloqueio XXE; validação XSD completa ficou para hardening fiscal | Antes de produção | P1 | Aberta |
| PEND-018 | Phase 5 / Estoque | Criar view materializada de saldo atual e rotina de refresh | Saldo atual está calculado por groupBy de movimentações; materialized view será necessária para volume e dashboards | Phase 6 dashboards ou hardening estoque | P2 | Aberta |
| PEND-019 | Phase 5 / Estoque | Implementar desfazer importação em até 24h com estornos do lote | Event sourcing e origem por XML foram preparados; UI/endpoint de undo ficaram fora da base inicial | Antes de liberar importação para usuários finais | P1 | Aberta |
| PEND-020 | Phase 5 / Alertas | Job diário de estoque mínimo e conciliação noturna de saldos | A posição de estoque já calcula críticos sob demanda; jobs recorrentes serão ligados à Central de Alertas/Phase 6 | Phase 6 alertas | P2 | Aberta |
| PEND-021 | Phase 6 / Alertas | Ligar eventos em tempo real via SSE por tenant e indicador "novo desde sua última visita" | A Fase 6 usa leitura sob demanda da API; SSE depende da estratégia definitiva de runtime/infra e canais por tenant | Hardening operacional ou primeiro piloto com uso concorrente | P2 | Aberta |
| PEND-022 | Phase 6 / Documentos | Exportação em lote ZIP com XML/PDF reais e envio por e-mail | CSV foi entregue; ZIP/e-mail dependem de empacotamento temporário, storage e provedor de e-mail transacional | Antes de liberar envio em lote para clientes | P1 | Aberta |
| PEND-023 | Phase 6 / Alertas | Persistir resolução, deduplicação 24h e regras customizadas de alertas | Alertas atuais são virtuais, derivados de certificados, documentos e estoque; persistência exige tabela própria e jobs recorrentes | Hardening de alertas | P1 | Aberta |
| PEND-024 | Phase 6 / Dashboards | Materialized views de KPIs e refresh incremental | Dashboards calculam sobre tabelas operacionais no MVP; budget de 2s em carteira grande exige views materializadas | Antes de carteira contábil com volume real | P2 | Aberta |
| PEND-025 | Phase 7 / Usuários e E-mails | Ligar provedor transacional para convites, redefinição de senha e teste/envio de templates fiscais | A Fase 7 criou usuários, perfis e templates persistidos; envio real depende da escolha de provedor SMTP/API e validação de domínio/remetente | Antes de piloto com usuários convidados por e-mail | P1 | Aberta |
| PEND-026 | Phase 8 / Go-live operacional | Definir se o próximo passo será um piloto controlado ou atacar pendências críticas primeiro | A decisão depende de apetite de risco, cliente piloto disponível, ambiente real e aceite sobre as pendências P0/P1 ainda abertas | Reunião de go/no-go pós-validação operacional | P0 | Aberta |

## Pendências Da Próxima Fase

Itens que devem ser decididos antes do próximo ciclo de execução:

- Se o próximo passo será piloto controlado ou ataque prévio às pendências críticas (`PEND-026`).
- Quais pendências P0/P1 entram antes de expor o produto a cliente real.
- Qual provedor de e-mail transacional será usado para envio de documentos fiscais.
- Como serão validadas as migrations, variáveis de produção e credenciais externas no ambiente alvo.

## Itens Resolvidos

Nenhum ainda neste registro central.
