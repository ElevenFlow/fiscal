# 16 — Observabilidade (Sentry + OpenTelemetry)

## Visão geral

Stack de observabilidade vendor-neutral em **4 camadas de redação de PII** + tracing distribuído + logs estruturados.

- **Errors** → Sentry (SDK Node + Browser).
- **Traces** → OpenTelemetry (OTLP HTTP) → AWS ADOT ou SigNoz.
- **Metrics** → OpenTelemetry → mesmo destino.
- **Logs** → Pino estruturado JSON → CloudWatch (transport) + replicado a Sentry para correlação.

Em dev, os exporters operam como **no-op** quando DSN/endpoint não está set. Zero overhead local.

## Status atual

**Complete (scaffold).**

| Componente | Status |
|-----------|--------|
| Pino com `redact` (PII básico) | Complete |
| Sentry SDK (backend) inicialização | Complete |
| Sentry SDK (browser) opt-in | Complete |
| `safeLog` whitelist | Complete |
| `beforeSend` Sentry — scrub adicional | Complete |
| OpenTelemetry SDK + OTLP HTTP | Complete (no-op se sem endpoint) |
| `SIGTERM` graceful shutdown + flush spans | Complete |
| Documentação `docs/OBSERVABILITY.md` | Complete |
| Dashboards prontos (SigNoz/Grafana) | Planejado |

## Arquivos envolvidos

### Backend (apps/api)
- `src/modules/observability/sentry.module.ts` — bootstrap Sentry no Nest
- `src/modules/observability/otel.ts` — `initOtel()` chamado **antes** de qualquer import (require-hook patching)
- `src/main.ts` — `initOtel()` é a primeira linha; depois `reflect-metadata`; depois `NestFactory`
- `src/logger/` — Pino + redact

### Frontend (apps/web)
- `src/instrumentation.ts` — Next.js bootstrap (Sentry server)
- `src/lib/sentry.client.ts` — Sentry browser (opt-in, replay disabled)

### Docs
- `docs/OBSERVABILITY.md`

## Variáveis de ambiente

```env
# Sentry
SENTRY_DSN=                        # vazio em dev → no-op
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
STRICT_SENTRY=false                # prod=true: falha boot se DSN ausente

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=       # vazio em dev → ConsoleSpanExporter
OTEL_SERVICE_NAME=nexofiscal-api
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev
```

## 4 camadas de redação de PII

```
camada 1 — Pino redact (formatação do log)
   redact: ['pfxBuffer', 'pfxPassword', 'cpfCnpj', 'password', 'req.headers.authorization']

camada 2 — safeLog (whitelist explícita por contexto)
   safeLog.audit({ action, resourceId, result })  // só campos permitidos

camada 3 — Sentry beforeSend (scrub adicional pré-envio)
   if (event.request) {
     delete event.request.cookies
     scrubBody(event.request.data)
   }

camada 4 — Sentry UI scrubbers (config no projeto Sentry)
   Padrões: cpf, cnpj, email patterns
```

> **Múltiplas camadas existem porque pino.redact é baseado em path** (`req.body.cpf`) e contextos dinâmicos vazam. As camadas seguintes pegam o que escapou.

## Pino — uso correto

```ts
import { Logger } from 'nestjs-pino';

@Injectable()
export class EmpresasService {
  constructor(private readonly logger: Logger) {}

  async create(dto: CreateEmpresaDto) {
    // OK: identificadores não-PII
    this.logger.log({ action: 'empresa.create', cnpj: dto.cnpj.slice(0, 6) + '****' });

    // NÃO faça: this.logger.log({ dto })  ← payload completo, vaza
  }
}
```

`safeLog` helper (futuro):
```ts
this.safeLog.audit({ action: 'empresa.create', resourceId: empresa.id });
```

## Sentry — patterns

### Capture com contexto
```ts
import * as Sentry from '@sentry/node';

Sentry.withScope(scope => {
  scope.setTag('module', 'emissao');
  scope.setUser({ id: ctx.userId });  // só id, nunca email
  scope.setContext('nota', { tipo: 'nfe', tenantId: ctx.empresaId });
  Sentry.captureException(err);
});
```

### Não capturar erros esperados
Erros de validação Zod, 4xx do gateway, denegação SEFAZ — são *business* não *bug*. Filtrar:

```ts
beforeSend(event, hint) {
  if (hint?.originalException instanceof BusinessException) return null;
  return event;
}
```

### Não enviar PII
```ts
beforeSend(event) {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
  return event;
}
```

## OpenTelemetry — instrumentação

`initOtel()` no `main.ts`:

```ts
// src/main.ts (RESUMO)
import { initOtel } from './modules/observability/otel';
initOtel();  // ANTES de qualquer outro import

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
// ...
```

### Auto-instrumentação ativa
- HTTP (axios, fetch, fastify)
- Postgres (`@opentelemetry/instrumentation-pg` via Prisma underlying)
- Redis (BullMQ traces)
- AWS SDK

### Desativada por verbosidade
- `@opentelemetry/instrumentation-fs` — gera spans para todo `fs.read`. Ative só se debugando I/O.

### Spans manuais
```ts
import { trace } from '@opentelemetry/api';
const tracer = trace.getTracer('emissao');

const span = tracer.startSpan('emit-nfe.gateway-call');
try {
  const result = await this.gateway.emit(payload);
  span.setAttribute('gateway', 'focus_nfe');
  span.setAttribute('chave_acesso', result.chave);  // OK: identificador, não dados pessoais
  return result;
} finally {
  span.end();
}
```

## Graceful shutdown

```ts
process.on('SIGTERM', async () => {
  logger.log('SIGTERM received, draining...');
  await app.close();             // fecha conexões DB/Redis
  await Sentry.flush(2000);
  await sdk.shutdown();          // OTel flush spans
  process.exit(0);
});
```

Sem isso, ECS Fargate mata o container e perde os últimos spans/erros.

## Dashboards (planejado)

### SigNoz — para tracing
- Latência p50/p95/p99 por endpoint
- Top endpoints lentos
- Trace de uma emissão (Nest → BullMQ → Gateway → S3)

### Grafana — para métricas + logs
- Taxa de denegação por UF (alerta se > 5% em 5 min)
- Tempo de resposta SEFAZ por UF (alerta se p95 > 5 s)
- Tamanho da fila BullMQ (alerta se > 1000 jobs pendentes)
- Saúde da fila por nome (`emit-nfe`, `emit-nfse`, `parse-import-xml`)

## Padrões e ressalvas

- **Sample rate baixo em traces** (`0.1` = 10%). Em emissão, considerar 100% temporário em incidentes.
- **`beforeSend` global** é última defesa, não a primeira. Não conte com ele.
- **SDK Sentry browser desativado por padrão** — replay pode capturar inputs, problema LGPD.
- **OTel quebra cold start** — em ambientes serverless, considere usar uma layer (AWS Lambda Insights) em vez do SDK.
- **NÃO use Datadog no MVP.** Bill imprevisível ($31/host + $0.10/span indexado escala rápido). Sentry + Grafana/SigNoz.
- **Correlação log↔trace:** Pino emite `traceId` + `spanId` quando em contexto OTel. UI do Sentry/SigNoz junta as views.

## Bibliotecas

| Pacote | Versão | Papel |
|--------|--------|-------|
| `pino` | 9.x | Logger |
| `nestjs-pino` | latest | Integração Nest |
| `@sentry/node` | latest | Backend errors |
| `@sentry/nextjs` | 10.x | Frontend + RSC errors |
| `@opentelemetry/sdk-node` | latest | OTel core |
| `@opentelemetry/exporter-trace-otlp-http` | latest | OTLP HTTP |
| `@opentelemetry/auto-instrumentations-node` | latest | Auto-instrumentação |

## Próximos passos

- [ ] Configurar projeto Sentry (production org + DSN per env)
- [ ] Configurar SigNoz self-hosted ou ADOT collector
- [ ] Dashboards prontos versionados (SigNoz JSON / Grafana JSON em `infra/observability/`)
- [ ] Alertas: taxa de denegação > 5%, p95 SEFAZ > 5s, fila > 1000 jobs
- [ ] Métricas custom: emissões/hora, MAU, certs vencidos
- [ ] Auditoria periódica: rodar `pnpm test:redaction` em CI (verifica que nenhum PII conhecido escapa do `pino.redact`)
