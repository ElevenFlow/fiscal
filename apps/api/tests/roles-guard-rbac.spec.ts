import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/db/prisma.service';
import { ROLES_KEY } from '../src/modules/rbac/roles.decorator';
import { RolesGuard } from '../src/modules/rbac/roles.guard';

/**
 * BLOCKER #1 regression — `RolesGuard` precisa envolver a query
 * `user_memberships` em `withTenantContext({ role: 'platform_admin', userId })`
 * para bypassar `FORCE ROW LEVEL SECURITY`. Sem esse wrap, a lookup sob
 * `app_user` (NOBYPASSRLS) retorna 0 linhas e TODA rota `@Roles(...)`
 * responderia 403 — bug silencioso que quebraria o produto inteiro.
 *
 * Estratégia do spec (unitário contra Postgres real):
 *  1. Seed via `app_admin` de User + UserMembership(scope=platform, role=admin).
 *  2. Monta `RolesGuard` diretamente com Reflector real + PrismaService conectado
 *     em `DATABASE_URL` (app_user — NOBYPASSRLS).
 *  3. Fabrica um ExecutionContext mínimo com req.auth contendo o userId seed.
 *  4. Fabrica reflection metadata `@Roles('admin')` no handler fake.
 *  5. Chama `guard.canActivate(ctx)` e espera `true`.
 *  6. Validação negativa: `req.auth.userId` inexistente → ForbiddenException.
 *
 * Pré-requisitos:
 *  - Postgres up (docker compose up -d postgres — Plan 02).
 *  - Migrations aplicadas (pnpm --filter @nexo/api db:migrate).
 *  - DATABASE_URL aponta para app_user (NOBYPASSRLS) — prova que o bypass é
 *    via `app.role` GUC e não via conexão privilegiada.
 *  - DATABASE_ADMIN_URL aponta para app_admin (BYPASSRLS) — usado apenas no seed.
 */

const TEST_USER_ID = '55555555-5555-5555-5555-555555555555';
const TEST_CLERK_ID = 'user_test_platform_admin';

const APP_USER_URL = process.env.DATABASE_URL;
const APP_ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const hasDbCredentials =
  !!APP_USER_URL?.includes('app_user') && !!APP_ADMIN_URL?.includes('app_admin');

// Se o banco não estiver configurado, pulamos o spec em vez de falhar.
const describeIfDb = hasDbCredentials ? describe : describe.skip;

function makeCtx(req: Record<string, unknown>, handler: () => unknown): ExecutionContext {
  // ExecutionContext mínimo para Reflector + HTTP switch
  return {
    getHandler: () => handler,
    getClass: () => class Fake {},
    switchToHttp: () => ({ getRequest: () => req }),
    // Membros não usados pelo RolesGuard
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getContext: () => ({}), getData: () => ({}) }),
    switchToWs: () => ({ getClient: () => ({}), getData: () => ({}) }),
    getType: () => 'http' as const,
  } as unknown as ExecutionContext;
}

describeIfDb('RolesGuard — BLOCKER #1 regression', () => {
  let adminPrisma: PrismaClient;
  let appUserPrisma: PrismaService;
  let guard: RolesGuard;

  beforeAll(async () => {
    // Seed via app_admin
    adminPrisma = new PrismaClient({ datasources: { db: { url: APP_ADMIN_URL } } });
    await adminPrisma.userMembership.deleteMany({ where: { userId: TEST_USER_ID } });
    await adminPrisma.user.upsert({
      where: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'platform-admin@test.local',
        clerkUserId: TEST_CLERK_ID,
      },
      update: { clerkUserId: TEST_CLERK_ID },
    });
    await adminPrisma.userMembership.create({
      data: {
        userId: TEST_USER_ID,
        scopeType: 'platform',
        scopeId: null,
        role: 'admin',
      },
    });

    // PrismaService conectado via DATABASE_URL (app_user — NOBYPASSRLS)
    appUserPrisma = new PrismaService();
    await appUserPrisma.$connect();

    const reflector = new Reflector();
    guard = new RolesGuard(reflector, appUserPrisma);
  });

  afterAll(async () => {
    if (appUserPrisma) await appUserPrisma.$disconnect();
    if (adminPrisma) {
      await adminPrisma.userMembership.deleteMany({ where: { userId: TEST_USER_ID } });
      await adminPrisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
      await adminPrisma.$disconnect();
    }
  });

  it('@Roles("admin") → true para platform_admin via publicMetadata (fast-path)', async () => {
    const handler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['admin'], handler);
    const ctx = makeCtx(
      {
        auth: {
          userId: TEST_USER_ID,
          contabilidadeId: null,
          role: 'platform_admin',
        },
      },
      handler,
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('@Roles("admin") → true via lookup em user_memberships (BLOCKER #1 — FORCE RLS bypass)', async () => {
    // Critical path: user com role='tenant_user' no JWT mas tem UserMembership(role='admin')
    // persistido. O RolesGuard DEVE consultar user_memberships — e o wrap em
    // withTenantContext({role:'platform_admin'}) faz o FORCE RLS liberar a query.
    const handler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['admin'], handler);
    const ctx = makeCtx(
      {
        auth: {
          userId: TEST_USER_ID,
          contabilidadeId: null,
          role: 'tenant_user', // força o caminho da lookup, não o fast-path
        },
      },
      handler,
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('@Roles("contabilidade_owner") → 403 para user sem membership contabilidade_owner', async () => {
    const handler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['contabilidade_owner'], handler);
    const ctx = makeCtx(
      {
        auth: {
          userId: TEST_USER_ID,
          contabilidadeId: null,
          role: 'tenant_user',
        },
      },
      handler,
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('rota sem @Roles() → true sem tocar DB', async () => {
    const handler = () => {};
    // Sem Reflect.defineMetadata(ROLES_KEY, ...)
    const ctx = makeCtx({ auth: { userId: TEST_USER_ID, role: 'tenant_user' } }, handler);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('sem req.auth → ForbiddenException (missing auth context)', async () => {
    const handler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['admin'], handler);
    const ctx = makeCtx({}, handler); // req sem .auth
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
