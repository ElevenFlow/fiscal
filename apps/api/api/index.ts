// Vercel serverless entrypoint para apps/api (NestJS + Fastify).
// Roteamento: vercel.json redireciona TODA request para esta função.
// Pattern: bootstrap NestJS uma vez por cold-start, cacheia em memória do worker.
//
// LIMITAÇÕES Vercel serverless (documentadas em docs/DEPLOY.md):
// - BullMQ workers NÃO funcionam (precisam processo sempre-quente). QueueModule
//   já faz no-op silencioso se REDIS_URL ausente — em Vercel, deixar vazio.
// - Cron schedulers (cert-expiration, lookup-sync) ficam offline. Migrar para
//   Vercel Cron + endpoint HTTP, ou para host always-on antes da Phase 3.
// - maxDuration 60s (Pro) — suficiente para auth/CRUD/cert upload, mas não
//   para emissão NFe com retry SEFAZ (Phase 3 exige migração).

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { Logger } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from '../src/app.module';
import { BusinessExceptionFilter } from '../src/common/business-exception.filter';

let cachedApp: NestFastifyApplication | undefined;
let bootstrapPromise: Promise<NestFastifyApplication> | undefined;

async function bootstrap(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024,
      files: 1,
    },
  });

  await app.register(cookie);

  app.useGlobalFilters(new BusinessExceptionFilter());
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function getApp(): Promise<NestFastifyApplication> {
  if (cachedApp) return cachedApp;
  if (!bootstrapPromise) bootstrapPromise = bootstrap();
  cachedApp = await bootstrapPromise;
  return cachedApp;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();
  const fastify = app.getHttpAdapter().getInstance();
  // Routing direto via Fastify (mais robusto que server.emit em serverless)
  fastify.routing(req, res);
}
