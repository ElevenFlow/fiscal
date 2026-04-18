// MUST be first — OTel precisa patchear require() antes de importar libs instrumentadas.
// (Plan 01-10: initOtel é idempotente e no-op se OTLP endpoint ausente → ConsoleSpanExporter em dev.)
import { initOtel } from './modules/observability/otel';
initOtel();

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Body parser padrão; Fastify já rejeita payloads > 1MB por default (ajustar se precisar)
      trustProxy: true, // Para X-Forwarded-For atrás de ALB/NGINX
    }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  // Global prefix — todas rotas em /api/...
  app.setGlobalPrefix('api');

  // CORS — frontend em 3000
  app.enableCors({
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Nexo Fiscal API running on http://localhost:${port}/api`);
  logger.log(`Health check: http://localhost:${port}/api/health`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal during bootstrap:', err);
  process.exit(1);
});
