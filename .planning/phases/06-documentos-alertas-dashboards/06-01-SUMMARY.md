# Phase 6 — Documentos + Alertas + Dashboards

**Status:** concluída em 2026-04-29  
**Escopo:** base técnica/operacional, sem integrações adiadas.

## Entregue

- Contratos compartilhados `operacional` para consulta/exportação de documentos e filtros de alertas.
- API operacional NestJS com rotas de documentos, exportação CSV, alertas virtuais, resolução no-op e dashboard consolidado.
- Proxies Next.js para `/api/documentos`, `/api/documentos/export`, `/api/alertas`, `/api/alertas/[id]/resolver` e `/api/dashboard`.
- Tela `/documentos` unificada para NF-e, NFS-e e Devolução, com filtros, seleção, timeline e downloads individuais.
- Tela `/alertas` conectada à API, com filtros por severidade/tipo/status e ação contextual.
- Dashboard principal conectado à API, mantendo variação por perfil: Admin, Contabilidade e Empresa.
- Sino do header usando contagem real de alertas críticos abertos.

## Pendências registradas

- `PEND-021`: SSE por tenant e indicador de novidades.
- `PEND-022`: ZIP real com XML/PDF em lote e envio por e-mail.
- `PEND-023`: resolução persistente, deduplicação 24h e regras customizadas de alertas.
- `PEND-024`: materialized views de KPIs e refresh incremental.

## Validação

- `pnpm.cmd --filter @nexo/shared typecheck`
- `pnpm.cmd --filter @nexo/shared build`
- `pnpm.cmd --filter @nexo/api typecheck`
- `pnpm.cmd --filter @nexo/web typecheck`
- `pnpm.cmd --filter @nexo/api build`
- `pnpm.cmd --filter @nexo/web build`

Observações: runtime local em Node v20.17.0 gerou warning de engine (`>=22`). Build web manteve warning conhecido de OpenTelemetry/Sentry.
