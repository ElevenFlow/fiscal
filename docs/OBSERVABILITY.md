# Observability — Nexo Fiscal

Runbook para provisionar Sentry e OpenTelemetry em dev/staging/prod.

Com DSN/endpoint vazios os SDKs são **no-op**: apps/api e apps/web sobem, logam "Sentry not initialized" (API) e rodam com `ConsoleSpanExporter` local (OTel). Tudo abaixo é operacional — nenhum passo exige alterar código.

## Sentry (apps/api + apps/web)

### 1. Criar projetos Sentry

1. Acesse https://sentry.io → crie uma organização (ou use existente).
2. Crie 2 projetos:
   - **nexofiscal-api** (Node.js)
   - **nexofiscal-web** (Next.js)
3. Capture os DSNs de cada um (formato `https://<chave>@o<org>.ingest.sentry.io/<projeto>`).

### 2. Provisionar envs

- **Dev local**: deixar DSN vazio → no-op (log "Sentry not initialized (SENTRY_DSN unset)").
- **Staging / Prod** (via AWS Secrets Manager → injetado em runtime):
  - `SENTRY_DSN=https://...@sentry.io/...` (backend)
  - `NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...` (frontend — pode ser público; Sentry valida via hostname/origem)
  - `SENTRY_ENVIRONMENT=production` (ou `staging`)
  - `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production`
  - `SENTRY_TRACES_SAMPLE_RATE=0.1` (10%; ajustar conforme custo e volume)

### 3. Data scrubbing — 4 camadas (defense-in-depth)

Garantir nos 4 níveis. Se uma camada falhar (ex: bug de logging com campo novo não-redigido), as outras capturam.

1. **Pino redact** — `apps/api/src/logger/redact-paths.ts` (Plan 01-05)
   - Blacklist de paths: `password`, `pfx*`, `cpf`, `cnpj`, `authorization`, `cookie`, `xml`, `token`, etc.
   - Aplicado em TODO log estruturado do NestJS.
2. **safeLog() whitelist** — `apps/api/src/logger/safe-log.ts` (Plan 01-05 WARNING #6)
   - Apenas 21 chaves operacionais seguras são permitidas (`tenantId`, `userId`, `action`, `ip`, `requestId`...).
   - Qualquer outra chave vira `[OMITTED]` — falha seguro quando novo campo com PII for adicionado.
3. **Sentry beforeSend** — `apps/api/src/modules/observability/sentry.module.ts` + `apps/web/src/instrumentation.ts` (Plan 01-10)
   - `event.request.data = '[REDACTED]'`
   - `event.request.cookies = { scrubbed: '[REDACTED]' }`
   - Backend também scrub `event.extra` para keys `xml`, `pfx`, `pfxBuffer`, `certificate`, `privateKey`, `cpf`, `cnpj`.
4. **Sentry UI data scrubbers** — dashboard Sentry
   - Settings → Security & Privacy → Data Scrubbers.
   - Habilitar "Prevent storing of IP Addresses" (se não precisar).
   - Habilitar "Require Scrub Data" + adicionar regex de CPF/CNPJ customizados.

### 4. DPA (Data Processing Agreement)

- PITFALLS.md #11 / ARCHITECTURE: assinar DPA com Sentry antes de enviar qualquer evento de produção.
- Sentry já oferece GDPR/LGPD-compatible DPA em https://sentry.io/legal/dpa/.
- DPO assina via interface Sentry → armazenar cópia em `docs/compliance/`.

### 5. Browser SDK (`apps/web/src/lib/sentry.client.ts`)

- `initSentryClient()` é **opcional** — importar e chamar em um `useEffect` no ClientProviders/RootLayout se quiser error tracking do lado do navegador.
- Session Replay **desligado** por default (`replaysSessionSampleRate: 0`). Para habilitar, passar integração com `maskAllText: true` + `blockAllMedia: true`.

## OpenTelemetry (apps/api)

### Opção 1 — AWS ADOT (recomendado para prod em AWS sa-east-1)

1. Deploy ADOT Collector como sidecar ECS (mesma task definition da API) ou Lambda extension.
2. Configure `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` (sidecar mesma task).
3. Traces fluem para CloudWatch Logs ou AWS X-Ray (configurado no collector).
4. Custo: ~$0.50/1M spans em X-Ray + CloudWatch storage.

### Opção 2 — SigNoz / Grafana Tempo / Jaeger

1. Deploy OTel Collector standalone (ECS Fargate ou EC2).
2. Configure `OTEL_EXPORTER_OTLP_ENDPOINT=https://<collector-endpoint>`.
3. Visualize em SigNoz Cloud, Grafana Cloud (Tempo), ou Jaeger self-hosted.
4. SigNoz Cloud: $49/mês para 20GB/mo de telemetria.

### Opção 3 — Dev local (console)

1. Deixe `OTEL_EXPORTER_OTLP_ENDPOINT` vazio.
2. `ConsoleSpanExporter` imprime spans no stdout — útil para debug local.
3. Log-grep por `"name":"GET /api/health"` ou por `traceId` para correlacionar.

### Sampling

- Default NodeSDK respeita `OTEL_TRACES_SAMPLER=parentbased_traceidratio` + `OTEL_TRACES_SAMPLER_ARG=0.1` (10%).
- Para fluxos fiscais críticos (emissão NF-e, cancelamento, upload de certificado), ajustar via **tracer manual** em Phase 3+ — forçar sample 100% em spans `fiscal.*`.
- Alertar via Grafana/SigNoz se `tracesSampleRate` saltar para 100% acidentalmente (custo explode).

### Instrumentations ativas (via `@opentelemetry/auto-instrumentations-node`)

- `http` / `https`
- `fastify`
- `pg` (Postgres driver nativo)
- `@prisma/instrumentation` (opcional — ver docs Prisma 6.x)
- `@aws-sdk/client-s3` / `@aws-sdk/client-kms` (Plan 01-08)
- `@opentelemetry/instrumentation-fs` **DESABILITADO** — ruído muito alto (milhares de spans por request).

## Healthchecks e canary

`GET /api/health` (Plan 01-05) retorna `{ status, db, uptime, timestamp }`. Sentry transactions apontam para esta rota e OTel gera span `GET /api/health` — útil para:

- Canary endpoint: se `/api/health` some do Sentry/OTel por >2min, provável incidente de deploy.
- Sanity check durante provisionamento: visite uma vez com DSN configurado → transação deve aparecer em 30s no Sentry.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|---------------|------|
| Boot log "Sentry not initialized" em prod | `SENTRY_DSN` não populado pelo Secrets Manager | Validar IAM task role + SM secret name; redeploy |
| OTel boot log "start failed" | Versão do SDK incompatível (ex: `sdk-node` vs `sdk-trace-node`) | Checar `apps/api/package.json` — versões devem casar (ver `pnpm why @opentelemetry/sdk-trace-node`) |
| Spans ausentes mas Sentry tem erros | `OTEL_EXPORTER_OTLP_ENDPOINT` inválido / collector down | Validar `curl <endpoint>/v1/traces` retorna 200; checar logs do collector |
| Sentry vazando CPF/CNPJ | Bug no `beforeSend` — adicionou campo novo sem scrub | Abrir incidente CRITICAL; revisar `apps/api/src/modules/observability/sentry.module.ts` + adicionar key ao scrub list |

## Referências

- PITFALLS.md #11 (logs/PII)
- Plan 01-05 (Pino redact + safeLog whitelist)
- Plan 01-09 (LGPD — Sentry scrubbing é camada final)
- Plan 01-10 (este scaffold)
- `docs/OPS_README.md` (operações gerais, incluindo incidentes LGPD)
- [Sentry Node.js SDK v8](https://docs.sentry.io/platforms/javascript/guides/node/)
- [Sentry Next.js SDK v8](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [OpenTelemetry NodeSDK](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [AWS ADOT Collector](https://aws-otel.github.io/docs/getting-started/collector)
