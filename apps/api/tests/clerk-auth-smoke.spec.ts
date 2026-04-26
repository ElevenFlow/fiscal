import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/db/prisma.service';
import { ClerkGuard, Public } from '../src/modules/auth/clerk.guard';
import { ClerkStrategy } from '../src/modules/auth/clerk.strategy';

/**
 * Plan 02-09 — smoke test mínimo após reativação Clerk no apps/web.
 *
 * Objetivo: comprovar que ClerkGuard, ClerkStrategy e o decorator @Public
 * permanecem instanciáveis após a religação do Clerk no apps/web.
 *
 * NOTA: Não bootstrapamos AppModule porque ele importa SentryModule, que puxa
 * @sentry/opentelemetry — esse pacote tem subpath imports (`/build/src/...`)
 * incompatíveis com o resolver vitest 2.x. Isso é problema pré-existente fora
 * do escopo do Plan 02-09 (SCOPE BOUNDARY rule). O smoke real é cobrir as
 * classes diretamente envolvidas na auth chain.
 *
 * Para regressão de RolesGuard contra Postgres real, ver
 * `tests/roles-guard-rbac.spec.ts` (BLOCKER #1 do Plan 01-07).
 */
describe('apps/api — auth chain pos religacao Clerk em apps/web (Plan 02-09)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ALLOW_HEADER_AUTH = 'true';
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('ClerkStrategy.verify retorna null sem CLERK_SECRET_KEY (T-02-09-05)', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_REPLACE_ME';
    const strategy = new ClerkStrategy();
    const claims = await strategy.verify('any-token');
    expect(claims).toBeNull();
  });

  it('ClerkStrategy.verify retorna null com secret válido mas token inválido', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy_for_verify_only';
    const strategy = new ClerkStrategy();
    const claims = await strategy.verify('not-a-valid-jwt');
    expect(claims).toBeNull();
  });

  it('ClerkGuard pode ser instanciado com Reflector + ClerkStrategy + PrismaService', () => {
    const reflector = new Reflector();
    const strategy = new ClerkStrategy();
    // PrismaService não conecta no constructor — só na primeira query (lazy init)
    const prisma = new PrismaService();
    const guard = new ClerkGuard(reflector, strategy, prisma);
    expect(guard).toBeInstanceOf(ClerkGuard);
  });

  it('@Public() decorator é exportado pelo módulo auth', () => {
    expect(typeof Public).toBe('function');
    const decorator = Public();
    expect(typeof decorator).toBe('function');
  });
});
