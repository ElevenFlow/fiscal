---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: phase_8_operational_validation_completed
last_updated: "2026-04-30T00:00:00.000Z"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 32
  completed_plans: 32
  percent: 100
---

# Nexo Fiscal — STATE

**Last updated:** 2026-04-30
**Status:** Phase 8 operational validation completed; MVP técnico validado localmente

---

## Project Reference

**Project:** Nexo Fiscal
**Core Value:** Emitir qualquer nota fiscal (NFS-e, NF-e ou devolução) em menos de um minuto, com a contabilidade responsável enxergando tudo em tempo real e sem fricção operacional para o empresário final.
**Current focus:** Pós-MVP — decisão de go/no-go entre piloto controlado e ataque prévio às pendências críticas

---

## Current Position

Phase: pós-roadmap / Fase 8 operacional
Plan: 08-01 completed
**Fases concluídas:** 1, 2, 02.1, 3, 4, 5, 6, 7 e 8 operacional
**Plans/Subfases:** 32 / 32 ✅ (01-01..01-10, 02-01..02-09, 02.1-01..02.1-04, 03-01..03-04, 04-01, 05-01, 06-01, 07-01, 08-01)
**Progress:** `[████████████████████] 100%` (roadmap v1 técnico + validação operacional local concluídos)
**Pendências centralizadas:** `.planning/PENDENCIAS.md`

**Next action:** decidir `PEND-026`: piloto controlado agora ou ataque prévio às pendências críticas P0/P1.

---

## Roadmap Snapshot

| Phase | Name | Reqs | Status |
|-------|------|------|--------|
| 1 | Foundation — Multi-tenant, Auth, RLS, Audit, UI Shell | 16 | ✅ Complete |
| 2 | Cadastros + Certificado A1 + Séries | 19 | ✅ Complete |
| 02.1 | Auth In-House — Foundation | FOUND-01..04 | ✅ Complete |
| 3 | SEFAZ-SC Direto + Emissão NF-e 55 | 13 | ✅ Complete técnico/base; homologação real pendente |
| 4 | Emissão NFS-e + Nota de Devolução | 2 | ✅ Complete técnico/base; integração municipal real pendente |
| 5 | Importação XML + Estoque | 14 | ✅ Complete técnico/base; jobs e undo pendentes |
| 6 | Documentos + Alertas + Dashboards (Diferencial) | 19 | ✅ Complete técnico/base; SSE, ZIP/e-mail e materialized views pendentes |
| 7 | Configurações + Usuários + Hardening | 5 | ✅ Complete técnico/base; e-mail transacional pendente |
| 8 | Validação Operacional Pós-MVP | Operacional | ✅ Complete local; validações externas dependem de credenciais/ambiente alvo |

Coverage: 88/88 requirements mapped.

---

## Phase 1 — O que foi entregue (10 plans)

| Plan | Subsystem | Resumo |
|------|-----------|--------|
| 01-01 | infra | Monorepo pnpm + Turborepo + Biome + tsconfig strict + `@nexo/shared` |
| 01-02 | infra | Postgres 16 local (Docker) + roles `app_user` / `app_admin` + extensões + runbook AWS |
| 01-03 | ui | `@nexo/ui` design system (shadcn + Tailwind preset + tokens Nexo + `<Money>` + `<StatusPill>`) |
| 01-04 | db-rls-audit | Prisma schema + RLS forçado + `withTenantContext` + `audit_log` imutável + suite RLS-regression |
| 01-05 | api-scaffold | NestJS 11 + Fastify + Pino redact + AuditService + AsyncLocalStorage tenant + `RolesGuard` |
| 01-06 | ui-shell | Next.js 15 App Router + shell (sidebar/header/cmdk) + 10 rotas placeholder |
| 01-07 | auth | Clerk Organizations + middleware + webhook svix + Bearer JWT + tenant-resolver |
| 01-08 | storage-ops | `S3Service` com Object Lock enforcement + `ObjectLockVerifier` + `OPS_README.md` |
| 01-09 | lgpd-portal | LGPD endpoints (export/correct/delete) + portal `/app/privacidade` + política pública |
| 01-10 | observability | Sentry no-op-sem-DSN + OpenTelemetry init + `OBSERVABILITY.md` |

---

## Execução após Phase 1

Após Phase 1, foi feito um **scaffold de UI mock para todas as Phases 2–7** (commits `feat(mock): ...` entre `522d51a` e `97ae6f8`):

- Cadastros (clientes/fornecedores/produtos/serviços/empresas/contabilidades) — listagens + forms
- Dashboards Admin / Contabilidade / Empresa
- Hub de emissão + telas NFS-e, NF-e, devolução
- Importação XML + revisão produto↔item + movimentações de estoque
- Documentos fiscais (consulta) + alertas + auditoria/logs + usuários + configurações

Adicional pós-mock: a Phase 2 integrou cadastros/certificado/séries à API real; a Phase 02.1 substituiu Clerk por auth in-house (JWT HS256 + argon2id + cookie HttpOnly); a Phase 3 implementou a base NF-e direta SEFAZ-SC; a Phase 4 implementou NFS-e operacional SC sem transmissão municipal real e Nota de Devolução interna; a Phase 5 implementou importação XML segura e estoque por movimentações reais; a Phase 6 implementou documentos unificados, alertas e dashboards operacionais; a Phase 7 implementou configurações, usuários e auditoria conectados à API.

**Validação Phase 3 em 2026-04-29:** `pnpm.cmd --filter @nexo/api test -- fiscal-gateway.spec.ts fiscal-xml-signature.spec.ts` passou (6/6); `pnpm.cmd --filter @nexo/api typecheck`, `pnpm.cmd --filter @nexo/web typecheck`, `pnpm.cmd --filter @nexo/api build` e `pnpm.cmd --filter @nexo/web build` passaram. Observação: runtime local usou Node v20.17.0, abaixo do alvo Node 22, gerando warning de engine; build web manteve warning conhecido de OpenTelemetry/Sentry.

**Limite da conclusão da Phase 3:** a base técnica/simulada está entregue; homologação real SEFAZ-SC/SVRS ainda exige certificado A1 ativo, senha/material mTLS no worker e migrations aplicadas no banco correto. DANFE atual é mínimo e deve evoluir para layout completo de produção.

---

## Performance Metrics

| Metric | Target | Phase 1 |
|--------|--------|---------|
| Phase 1 cycle time | — | ~7 dias (17/04 → 24/04) |
| Plans entregues | 10 | 10 ✅ |
| Must-have success rate | 100% | a verificar via `/gsd-verify-work` |

---

## Accumulated Context

### Key Decisions

- Multi-tenant hierárquico em 3 níveis (Admin → Contabilidade → Empresa)
- NFS-e inicial: base operacional orientada a Santa Catarina; integrações municipais reais serão escolhidas apenas quando houver primeiro cliente e município concreto.
- Certificado A1 only no MVP (A3 diferido)
- Stack: TS 5.6 + Next 16 + NestJS 11/Fastify + Postgres 16 + RLS + Prisma 6 + BullMQ + AWS sa-east-1
- Fiscal: integração direta inicial com SEFAZ-SC para NF-e 55; SOAP/XMLDSig encapsulados em `SefazScGateway` atrás da porta interna `FiscalGateway`
- Retenção fiscal: S3 Object Lock Compliance Mode, 6 anos
- Auth: in-house JWT HS256 + argon2id + sessions com refresh rotation (Phase 02.1 concluída)
- Object Lock decidido: **Compliance Mode** para XMLs autorizados; **Governance Mode** para bucket de certificados (.pfx)

### Open Todos

- [x] Aplicar/confirmar migrations Phase 3 no banco alvo Neon e validar RLS de `nota_fiscal`/eventos em banco real (`PEND-001` resolvida em 2026-05-01).
- [ ] Executar homologação real SEFAZ-SC/SVRS com certificado A1 ativo e material mTLS entregue ao worker de forma segura.
- [x] Evoluir DANFE mínimo para layout DANFE completo antes de produção (`PEND-004` resolvida em 2026-05-01).
- [ ] Integração municipal real NFS-e SC apenas após primeiro cliente/município concreto (`PEND-013`, `PEND-014`).
- [x] Aplicar/confirmar migrations Phase 5 no banco alvo Neon e validar RLS de `xml_importacoes`/`movimentacoes_estoque` (`PEND-015` resolvida em 2026-05-01).
- [ ] Retomar pendências Phase 5: worker sem egress, XSD completo, materialized view, undo 24h e jobs de alertas/reconciliação.
- [ ] Retomar pendências Phase 6: SSE por tenant, ZIP/XML/PDF em lote com e-mail, alertas persistentes/deduplicados e materialized views de KPIs.
- [ ] Definir provedor transacional para convites, redefinição de senha e envio de documentos fiscais (`PEND-025`).
- [ ] Definir se o próximo passo será piloto controlado ou ataque prévio às pendências críticas (`PEND-026`).

### Active Blockers

Nenhum.

### Research Flags

- **Phase 5** → resolved para base técnica; pendências em `.planning/PENDENCIAS.md`
- **Phase 6** → resolved para base operacional; pendências em `.planning/PENDENCIAS.md`
- **Phases 2, 7**: sem research adicional necessária

---

## Session Continuity

### Last session (2026-04-24)

- `feat(auth)`: gate single-user com cookie HMAC (modo protótipo) — apps/api e web
- `fix(api)`: `prisma generate` antes de `nest build` em deploy Vercel
- Bumps: Next 15.1 → 16.2.4, Sentry 10.50.0 — patches de segurança
- Vercel build do monorepo filtrado para `@nexo/web` apenas

### Phase 1 sessions (2026-04-17 → 2026-04-24)

- Plans 01-01 a 01-10 todos executados com SUMMARY
- Mocks de UI das Phases 2–7 construídos antes da implementação real (revisão e integração ainda devidas)

### Last validation (2026-04-29)

- Phase 3 validada por artefatos e checks: testes fiscais 6/6, API/web typecheck e API/web build.
- Rotas web Phase 3 aparecem no build: `/api/fiscal/nfe`, `/api/fiscal/nfe/[id]`, `/emitir/nf-e`, `/documentos` e downloads XML/DANFE.
- Phase 4 executada e validada: testes fiscais 9/9, shared/API/web typecheck, API/web build. Rotas web novas no build: `/api/fiscal/nfse`, `/api/fiscal/nfse/[id]/autorizar-interno`, `/api/fiscal/devolucoes`, `/api/fiscal/devolucoes/[id]/autorizar-interno`, XML/PDF.
- Phase 5 executada e validada: parser XML 2/2, shared/API/web typecheck, API/web build. Rotas web novas no build: `/api/estoque/importacoes`, `/api/estoque/importacoes/xml`, `/api/estoque/importacoes/[id]/confirmar`, `/api/estoque/movimentacoes`, `/api/estoque/posicao`.
- Phase 6 executada e validada: shared/API/web typecheck, shared/API/web build. Rotas web novas no build: `/api/documentos`, `/api/documentos/export`, `/api/alertas`, `/api/alertas/[id]/resolver`, `/api/dashboard`.
- Phase 7 executada e validada: shared build, API/web typecheck. Rotas web novas: `/api/configuracoes`, `/api/usuarios`, `/api/usuarios/[id]`, `/api/usuarios/[id]/acao`, `/api/auditoria`.

### Last validation (2026-04-30)

- Phase 8 operacional executada: `pnpm.cmd --filter @nexo/shared typecheck`, `pnpm.cmd --filter @nexo/api typecheck`, `pnpm.cmd --filter @nexo/web typecheck`, `pnpm.cmd --filter @nexo/api build`, `pnpm.cmd --filter @nexo/web build` e testes fiscais focados passaram.
- Testes fiscais focados: `fiscal-gateway.spec.ts` e `fiscal-xml-signature.spec.ts` passaram com 6/6 testes.
- `vercel.json` revisado: build de deploy configurado para `pnpm turbo run build --filter=@nexo/web` e install com `pnpm install --frozen-lockfile`.
- Limites da validação: ambiente local está em Node v20.17.0 enquanto o projeto exige Node >=22; build web mantém warning conhecido de OpenTelemetry/Sentry; validação real de Vercel, variáveis de produção, migrations no banco alvo e AWS/S3/KMS exige credenciais e ambiente externo.
- Nova pendência registrada: `PEND-026`, decisão entre piloto controlado e ataque prévio às pendências críticas.

### Next session

- Resolver `PEND-026` e, conforme a decisão, planejar piloto controlado ou atacar primeiro as pendências P0/P1.

---

*STATE.md is project memory — update at each phase transition, plan completion and significant decision.*
