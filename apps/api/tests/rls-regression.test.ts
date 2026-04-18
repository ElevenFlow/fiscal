import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTenantContext } from '../src/db/with-tenant';

/**
 * Suite de regressão RLS — valida isolamento cross-tenant no Postgres.
 * PITFALLS.md #1: vazamento cross-tenant é incidente crítico.
 *
 * Requisitos cobertos:
 * - FOUND-05: Empresa A jamais vê Empresa B
 * - FOUND-06: Contabilidade acessa carteira via contabilidade_empresas
 * - FOUND-07: Admin platform bypassa tenant isolation (controlado)
 * - FOUND-09: audit_log é imutável (UPDATE/DELETE rejeitados)
 *
 * Pré-requisitos:
 * - Postgres local rodando (Plan 02 checkpoint aprovado)
 * - Migrations aplicadas (pnpm db:migrate)
 * - Seed rodado (pnpm db:seed)
 * - DATABASE_URL aponta para app_user (NOBYPASSRLS)
 * - DATABASE_ADMIN_URL aponta para app_admin (BYPASSRLS)
 */

const UUIDS = {
  userTest: '11111111-1111-1111-1111-111111111111',
  contabilidade: '22222222-2222-2222-2222-222222222222',
  empresaA: '33333333-3333-3333-3333-333333333333',
  empresaB: '44444444-4444-4444-4444-444444444444',
} as const;

const APP_USER_URL = process.env.DATABASE_URL;
const APP_ADMIN_URL = process.env.DATABASE_ADMIN_URL;

if (!APP_USER_URL?.includes('app_user')) {
  throw new Error(
    'DATABASE_URL deve apontar para app_user (NOBYPASSRLS) para testes RLS. ' +
      'Valor atual não contém "app_user" — ajuste seu .env ou exporte DATABASE_URL antes de rodar.',
  );
}
if (!APP_ADMIN_URL?.includes('app_admin')) {
  throw new Error('DATABASE_ADMIN_URL deve apontar para app_admin (BYPASSRLS).');
}

describe('RLS regression — isolamento multi-tenant', () => {
  let appUserPrisma: PrismaClient;
  let adminPrisma: PrismaClient;

  beforeAll(async () => {
    appUserPrisma = new PrismaClient({ datasources: { db: { url: APP_USER_URL } } });
    adminPrisma = new PrismaClient({ datasources: { db: { url: APP_ADMIN_URL } } });

    // BLOCKER #3 — Assertion de identidade: o DATABASE_URL DEVE apontar para app_user
    // com NOBYPASSRLS. Sem isso, um .env mal configurado apontando para app_admin
    // faria TODOS os testes passarem falsamente (BYPASSRLS retorna tudo como se RLS estivesse OK).
    const identityRows = await appUserPrisma.$queryRaw<
      Array<{ current_user: string; is_superuser: string }>
    >`SELECT current_user::text AS current_user, current_setting('is_superuser') AS is_superuser`;
    const identity = identityRows[0];
    if (!identity) {
      throw new Error('FATAL: não foi possível consultar identidade da conexão.');
    }
    if (identity.current_user !== 'app_user') {
      throw new Error(
        `FATAL: conexão de testes está como '${identity.current_user}', esperado 'app_user'. ` +
          'Ajuste DATABASE_URL para app_user (NOBYPASSRLS). CI com identidade errada = falso-positivo verde.',
      );
    }
    if (identity.is_superuser !== 'off') {
      throw new Error('FATAL: conexão de testes está como superuser. RLS regression inválida.');
    }

    // Garantir que seed rodou (cria A, B, contabilidade) — usa admin para verificação
    const empresaA = await adminPrisma.empresa.findUnique({ where: { id: UUIDS.empresaA } });
    const empresaB = await adminPrisma.empresa.findUnique({ where: { id: UUIDS.empresaB } });
    if (!empresaA || !empresaB) {
      throw new Error(
        'Seed não rodou. Execute `pnpm --filter @nexo/api db:seed` antes dos testes.',
      );
    }
  });

  // BLOCKER #3 — limpar GUCs residuais entre testes. Pools Prisma podem reusar conexão
  // e carregar 'app.current_tenant' de teste anterior (fora de transação). RESET ALL
  // scrub todos os session-scoped GUCs antes de cada cenário.
  beforeEach(async () => {
    await appUserPrisma.$executeRawUnsafe('RESET ALL');
  });

  afterAll(async () => {
    await appUserPrisma.$disconnect();
    await adminPrisma.$disconnect();
  });

  // ===========================================================================
  // FOUND-05: isolamento empresa
  // ===========================================================================
  describe('FOUND-05: isolamento empresa', () => {
    it('app_user sem withTenantContext vê 0 empresas (RLS default restritivo)', async () => {
      // Fora de transação + sem SET LOCAL → GUC vazio → policy USING resolve NULL::uuid
      // Como tenant_id IS NOT NULL sempre, (NULL = tenant_id) é NULL (não TRUE) → nega
      const rows = await appUserPrisma.empresa.findMany();
      expect(rows).toHaveLength(0);
    });

    it('withTenantContext(tenant A) vê apenas empresa A', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.empresaA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.empresa.findMany(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(UUIDS.empresaA);
    });

    it('withTenantContext(tenant B) vê apenas empresa B', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.empresaB, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.empresa.findMany(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(UUIDS.empresaB);
    });

    it('tenant A NÃO consegue findUnique em tenant B mesmo sabendo o ID', async () => {
      const row = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.empresaA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.empresa.findUnique({ where: { id: UUIDS.empresaB } }),
      );
      expect(row).toBeNull();
    });
  });

  // ===========================================================================
  // FOUND-06: contabilidade acessa carteira
  // ===========================================================================
  describe('FOUND-06: contabilidade acessa carteira', () => {
    it('contabilidade vê ambas empresas da carteira via contabilidade_empresas', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        {
          tenantId: null,
          contabilidadeId: UUIDS.contabilidade,
          userId: UUIDS.userTest,
          role: 'tenant_user',
        },
        async (tx) => tx.empresa.findMany({ orderBy: { cnpj: 'asc' } }),
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const ids = rows.map((r) => r.id).sort();
      expect(ids).toContain(UUIDS.empresaA);
      expect(ids).toContain(UUIDS.empresaB);
    });
  });

  // ===========================================================================
  // FOUND-07: admin platform bypass
  // ===========================================================================
  describe('FOUND-07: admin platform bypass', () => {
    it('role=platform_admin vê todas empresas (mesmo sem tenantId)', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: null, userId: UUIDS.userTest, role: 'platform_admin' },
        async (tx) => tx.empresa.findMany(),
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================================================
  // FOUND-09: audit_log imutabilidade
  // ===========================================================================
  describe('FOUND-09: audit_log imutabilidade', () => {
    let auditId: string;

    beforeEach(async () => {
      // Cria um registro para tentar mutar nos testes abaixo
      const created = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.empresaA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) =>
          tx.auditLog.create({
            data: {
              tenantId: UUIDS.empresaA,
              userId: UUIDS.userTest,
              action: 'test.insert',
              result: 'success',
            },
          }),
      );
      auditId = created.id;
    });

    // ------------------------------------------------------------------
    // Defesa em camadas: app_user é bloqueado por REVOKE (camada 1).
    // Essa é a defesa em runtime normal: quem abre conexão via DATABASE_URL
    // nunca consegue UPDATE/DELETE porque o GRANT foi revogado.
    // ------------------------------------------------------------------
    it('UPDATE em audit_log é bloqueado para app_user (REVOKE — camada 1)', async () => {
      await expect(
        withTenantContext(
          appUserPrisma,
          { tenantId: UUIDS.empresaA, userId: UUIDS.userTest, role: 'tenant_user' },
          async (tx) =>
            tx.$executeRaw`UPDATE audit_log SET action = 'tampered' WHERE id = ${auditId}::uuid`,
        ),
      ).rejects.toThrow(/permission denied|immutable/i);
    });

    it('DELETE em audit_log é bloqueado para app_user (REVOKE — camada 1)', async () => {
      await expect(
        withTenantContext(
          appUserPrisma,
          { tenantId: UUIDS.empresaA, userId: UUIDS.userTest, role: 'tenant_user' },
          async (tx) => tx.$executeRaw`DELETE FROM audit_log WHERE id = ${auditId}::uuid`,
        ),
      ).rejects.toThrow(/permission denied|immutable/i);
    });

    // ------------------------------------------------------------------
    // Defesa em camadas: mesmo app_admin (BYPASSRLS, owner da tabela) é
    // bloqueado pelo trigger BEFORE UPDATE/DELETE (camada 2). Este é o
    // teste fiscal-crítico — prova que NINGUÉM consegue alterar o audit.
    // ------------------------------------------------------------------
    it('UPDATE em audit_log é rejeitado pelo trigger mesmo com admin (camada 2)', async () => {
      await expect(
        adminPrisma.$executeRaw`UPDATE audit_log SET action = 'tampered' WHERE id = ${auditId}::uuid`,
      ).rejects.toThrow(/immutable/i);
    });

    it('DELETE em audit_log é rejeitado pelo trigger mesmo com admin (camada 2)', async () => {
      await expect(
        adminPrisma.$executeRaw`DELETE FROM audit_log WHERE id = ${auditId}::uuid`,
      ).rejects.toThrow(/immutable/i);
    });

    it('INSERT em audit_log succeeds (append permitido)', async () => {
      const created = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.empresaA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) =>
          tx.auditLog.create({
            data: {
              tenantId: UUIDS.empresaA,
              userId: UUIDS.userTest,
              action: 'test.second_insert',
              result: 'success',
            },
          }),
      );
      expect(created.id).toBeDefined();
    });
  });

  // ===========================================================================
  // Anti-injection via withTenantContext
  // ===========================================================================
  describe('Anti-injection via withTenantContext', () => {
    it('rejeita UUID malformado antes de tocar Postgres', async () => {
      await expect(
        withTenantContext(
          appUserPrisma,
          {
            tenantId: "'; DROP TABLE empresas; --",
            userId: UUIDS.userTest,
            role: 'tenant_user',
          },
          async (tx) => tx.empresa.findMany(),
        ),
      ).rejects.toThrow(/Invalid tenantId UUID/);
    });

    it('rejeita role não-enumerado', async () => {
      await expect(
        withTenantContext(
          appUserPrisma,
          {
            tenantId: UUIDS.empresaA,
            userId: UUIDS.userTest,
            // biome-ignore lint/suspicious/noExplicitAny: teste intencional de valor fora da whitelist
            role: 'superadmin' as any,
          },
          async (tx) => tx.empresa.findMany(),
        ),
      ).rejects.toThrow(/Invalid role/);
    });
  });
});
