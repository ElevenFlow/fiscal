import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;

/**
 * initOtel — MUST be called FIRST (before importing any instrumented lib).
 * Idempotente: chamadas subsequentes são no-op.
 *
 * Em dev (OTLP endpoint ausente): usa ConsoleSpanExporter para feedback imediato.
 * Em prod: OTLP HTTP — geralmente um OTel Collector sidecar ou AWS ADOT.
 *
 * Instrumentations ativas via `@opentelemetry/auto-instrumentations-node`:
 *   - http / https / fastify / pg / prisma / @aws-sdk/*
 *   - `@opentelemetry/instrumentation-fs` DESABILITADO (ruído — milhares de spans/req).
 *
 * Sampler: o NodeSDK default respeita OTEL_TRACES_SAMPLER / OTEL_TRACES_SAMPLER_ARG.
 * Recomendação de prod: `OTEL_TRACES_SAMPLER=parentbased_traceidratio` + `OTEL_TRACES_SAMPLER_ARG=0.1`.
 */
export function initOtel(): void {
  if (sdk) return;

  // Log diag em nível WARN para não poluir
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traceExporter = endpoint
    ? new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
    : new ConsoleSpanExporter();

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'nexofiscal-api',
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Reduzir ruído — fs gera milhares de spans
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // Mantém http, fastify, postgres, prisma, aws-sdk
      }),
    ],
  });

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(
      `[otel] started — serviceName=${process.env.OTEL_SERVICE_NAME ?? 'nexofiscal-api'} exporter=${endpoint ? 'otlp' : 'console'}`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[otel] start failed:', (err as Error).message);
  }

  // Graceful shutdown para flush de spans pendentes
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      // eslint-disable-next-line no-console
      .then(() => console.log('[otel] shutdown complete'))
      // eslint-disable-next-line no-console
      .catch((err) => console.error('[otel] shutdown error:', err));
  });
}
