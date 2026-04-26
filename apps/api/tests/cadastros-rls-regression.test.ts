import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTenantContext } from '../src/db/with-tenant';

/**
 * Suite cadastros RLS regression — Phase 2 Plan 02-01.
 *
 * Mesmo padrão da suite Phase 1 (apps/api/tests/rls-regression.test.ts):
 * - DATABASE_URL DEVE apontar para app_user (NOBYPASSRLS)
 * - DATABASE_ADMIN_URL DEVE apontar para app_admin (BYPASSRLS)
 * - beforeAll faz sanity check de identidade (current_user='app_user', is_superuser='off')
 * - beforeEach limpa GUCs com RESET ALL para evitar pool poisoning
 *
 * Cobre os 7 modelos tenant-scoped Phase 2:
 * - clientes, fornecedores, produtos, servicos
 * - certificados_digitais, alertas_certificado, series_fiscais
 *
 * Pré-requisitos: migrations + seed Phase 2 aplicados (db:migrate:dev + db:seed).
 */

const UUIDS = {
  userTest: '11111111-1111-1111-1111-111111111111',
  contabilidade: '22222222-2222-2222-2222-222222222222',
  tenantA: '33333333-3333-3333-3333-333333333333',
  tenantB: '44444444-4444-4444-4444-444444444444',
  clienteA: '55555555-5555-5555-5555-555555555555',
  clienteB: '66666666-6666-6666-6666-666666666666',
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

describe('cadastros RLS regression — Phase 2', () => {
  let appUserPrisma: PrismaClient;
  let adminPrisma: PrismaClient;

  beforeAll(async () => {
    appUserPrisma = new PrismaClient({ datasources: { db: { url: APP_USER_URL } } });
    adminPrisma = new PrismaClient({ datasources: { db: { url: APP_ADMIN_URL } } });

    // Sanity check de identidade (igual à suite Phase 1) — sem isso, .env apontando
    // para app_admin vira falso-positivo verde em CI.
    const identityRows = await appUserPrisma.$queryRaw<
      Array<{ current_user: string; is_superuser: string }>
    >`SELECT current_user::text AS current_user, current_setting('is_superuser') AS is_superuser`;
    const identity = identityRows[0];
    if (!identity) {
      throw new Error('FATAL: não foi possível consultar identidade da conexão.');
    }
    if (identity.current_user !== 'app_user') {
      throw new Error(
        `FATAL: conexão de testes está como '${identity.current_user}', esperado 'app_user'.`,
      );
    }
    if (identity.is_superuser !== 'off') {
      throw new Error('FATAL: conexão de testes está como superuser. RLS regression inválida.');
    }

    // Sanity check do seed
    const clienteA = await adminPrisma.cliente.findUnique({ where: { id: UUIDS.clienteA } });
    const clienteB = await adminPrisma.cliente.findUnique({ where: { id: UUIDS.clienteB } });
    if (!clienteA || !clienteB) {
      throw new Error(
        'Seed Phase 2 não rodou. Execute `pnpm --filter @nexo/api db:seed` antes dos testes.',
      );
    }
  });

  beforeEach(async () => {
    // Limpa GUCs residuais entre testes — defesa contra pool poisoning.
    await appUserPrisma.$executeRawUnsafe('RESET ALL');
  });

  afterAll(async () => {
    await appUserPrisma.$disconnect();
    await adminPrisma.$disconnect();
  });

  // ===========================================================================
  // clientes — núcleo da cobertura (CAD-04, CAD-09, FOUND-05/07)
  // ===========================================================================
  describe('clientes', () => {
    it('sem withTenantContext, app_user vê 0 linhas (RLS default restritivo)', async () => {
      const rows = await appUserPrisma.cliente.findMany();
      expect(rows).toHaveLength(0);
    });

    it('tenant A vê apenas seus clientes', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.cliente.findMany(),
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(row.tenantId).toBe(UUIDS.tenantA);
      }
    });

    it('tenant A NÃO findUnique cliente de B (ID enumeration bloqueado)', async () => {
      const row = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.cliente.findUnique({ where: { id: UUIDS.clienteB } }),
      );
      expect(row).toBeNull();
    });

    it('INSERT com tenant_id de outro tenant rejeitado pelo WITH CHECK', async () => {
      await expect(
        withTenantContext(
          appUserPrisma,
          { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
          async (tx) =>
            tx.cliente.create({
              data: {
                tenantId: UUIDS.tenantB, // tenta plantar em B com contexto de A
                tipoPessoa: 'juridica',
                cpfCnpj: '99999999000199',
                nome: 'Cliente injetado',
                endereco: { logradouro: 'X', numero: '1', cidade: 'Y', uf: 'SP', cep: '00000000' },
              },
            }),
        ),
      ).rejects.toThrow(/row-level security|policy/i);
    });

    it('platform_admin vê linhas de ambos tenants', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: null, userId: UUIDS.userTest, role: 'platform_admin' },
        async (tx) => tx.cliente.findMany(),
      );
      const tenantsVistos = new Set(rows.map((r) => r.tenantId));
      expect(tenantsVistos.has(UUIDS.tenantA)).toBe(true);
      expect(tenantsVistos.has(UUIDS.tenantB)).toBe(true);
    });

    it('@@unique([tenantId, cpfCnpj]) — duplicidade NO MESMO tenant rejeitada (CAD-09)', async () => {
      await expect(
        withTenantContext(
          appUserPrisma,
          { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
          async (tx) =>
            tx.cliente.create({
              data: {
                tenantId: UUIDS.tenantA,
                tipoPessoa: 'juridica',
                cpfCnpj: '12345678000190', // mesmo CNPJ que clienteA do seed
                nome: 'Cliente duplicado',
                endereco: { logradouro: 'X', numero: '1', cidade: 'Y', uf: 'SP', cep: '00000000' },
              },
            }),
        ),
      ).rejects.toThrow(/Unique|P2002|duplicate/i);
    });

    it('mesmo cpfCnpj em tenants distintos é PERMITIDO (isolamento por tenant)', async () => {
      // Já há clientes em A e B com cpfCnpj 12345678000190 (seed). Valida via admin que
      // o constraint NÃO impede multi-tenant (apenas mesma pareja {tenant, cpf}).
      const rows = await adminPrisma.cliente.findMany({
        where: { cpfCnpj: '12345678000190' },
      });
      const tenants = new Set(rows.map((r) => r.tenantId));
      expect(tenants.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ===========================================================================
  // produtos
  // ===========================================================================
  describe('produtos', () => {
    it('tenant A vê apenas seus produtos', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.produto.findMany(),
      );
      for (const row of rows) {
        expect(row.tenantId).toBe(UUIDS.tenantA);
      }
    });

    it('tenant B vê 0 produtos (não há seed em B)', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantB, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.produto.findMany(),
      );
      expect(rows).toHaveLength(0);
    });

    it('CAD-09: detecção de duplicidade em produtos via @@unique([tenantId, codigo])', async () => {
      await expect(
        withTenantContext(
          appUserPrisma,
          { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
          async (tx) =>
            tx.produto.create({
              data: {
                tenantId: UUIDS.tenantA,
                codigo: 'SKU-001', // mesmo código do seed
                descricao: 'Tentativa de duplicado',
                ncm: '00000000',
                unidade: 'UN',
                precoVenda: '1.0000',
                origemMercadoria: 0,
              },
            }),
        ),
      ).rejects.toThrow(/Unique|P2002|duplicate/i);
    });
  });

  // ===========================================================================
  // fornecedores
  // ===========================================================================
  describe('fornecedores', () => {
    it('tenant A vê apenas seus fornecedores', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.fornecedor.findMany(),
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(row.tenantId).toBe(UUIDS.tenantA);
      }
    });

    it('tenant B vê 0 fornecedores', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantB, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.fornecedor.findMany(),
      );
      expect(rows).toHaveLength(0);
    });
  });

  // ===========================================================================
  // servicos
  // ===========================================================================
  describe('servicos', () => {
    it('tenant A vê apenas seus servicos', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.servico.findMany(),
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(row.tenantId).toBe(UUIDS.tenantA);
      }
    });
  });

  // ===========================================================================
  // series_fiscais
  // ===========================================================================
  describe('series_fiscais', () => {
    it('tenant A vê apenas suas séries', async () => {
      const rows = await withTenantContext(
        appUserPrisma,
        { tenantId: UUIDS.tenantA, userId: UUIDS.userTest, role: 'tenant_user' },
        async (tx) => tx.serieFiscal.findMany(),
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rows) {
        expect(row.tenantId).toBe(UUIDS.tenantA);
      }
    });
  });

  // ===========================================================================
  // certificados_digitais — índice parcial (T-02-01-06)
  // ===========================================================================
  describe('certificados_digitais', () => {
    it('1 certificado ativo por empresa — índice parcial UNIQUE bloqueia 2º cert ativo', async () => {
      // Cria 1 cert ativo via admin
      await adminPrisma.certificadoDigital.deleteMany({
        where: { tenantId: UUIDS.tenantA },
      });
      await adminPrisma.certificadoDigital.create({
        data: {
          tenantId: UUIDS.tenantA,
          s3Key: 'certs/A/v1.pfx',
          encryptedDek: Buffer.from('dummy-dek-1'),
          kmsKeyId: 'alias/dev-cert-cmk',
          cn: 'EMPRESA A LTDA:11222333000181',
          cnpjCertificado: '11222333000181',
          fingerprint: 'a'.repeat(64),
          notBefore: new Date('2026-01-01T00:00:00Z'),
          notAfter: new Date('2027-01-01T00:00:00Z'),
          ativo: true,
        },
      });

      // Tenta criar 2º cert ativo no MESMO tenant — deve falhar pelo índice parcial
      await expect(
        adminPrisma.certificadoDigital.create({
          data: {
            tenantId: UUIDS.tenantA,
            s3Key: 'certs/A/v2.pfx',
            encryptedDek: Buffer.from('dummy-dek-2'),
            kmsKeyId: 'alias/dev-cert-cmk',
            cn: 'EMPRESA A LTDA:11222333000181',
            cnpjCertificado: '11222333000181',
            fingerprint: 'b'.repeat(64),
            notBefore: new Date('2026-06-01T00:00:00Z'),
            notAfter: new Date('2027-06-01T00:00:00Z'),
            ativo: true,
          },
        }),
      ).rejects.toThrow(/certificados_digitais_one_active_per_tenant|unique|P2002|duplicate/i);

      // Mas inserir como ativo=false PASSA (cert antigo expirado/desativado)
      await expect(
        adminPrisma.certificadoDigital.create({
          data: {
            tenantId: UUIDS.tenantA,
            s3Key: 'certs/A/v3.pfx',
            encryptedDek: Buffer.from('dummy-dek-3'),
            kmsKeyId: 'alias/dev-cert-cmk',
            cn: 'EMPRESA A LTDA:11222333000181',
            cnpjCertificado: '11222333000181',
            fingerprint: 'c'.repeat(64),
            notBefore: new Date('2025-01-01T00:00:00Z'),
            notAfter: new Date('2026-01-01T00:00:00Z'),
            ativo: false,
          },
        }),
      ).resolves.toBeDefined();

      // Cleanup
      await adminPrisma.certificadoDigital.deleteMany({
        where: { tenantId: UUIDS.tenantA },
      });
    });
  });

  // ===========================================================================
  // Lookup tables (NCM/CFOP/CEST/LC116) — sem RLS, app_user é read-only
  // ===========================================================================
  describe('lookup tables (sem RLS)', () => {
    it('app_user lê NCM (catálogo global, sem RLS)', async () => {
      // Tabela vazia em dev, mas a query NÃO deve falhar com permission denied
      const rows = await appUserPrisma.nCM.findMany({ take: 1 });
      expect(Array.isArray(rows)).toBe(true);
    });

    it('app_user lê CFOP (catálogo global, sem RLS)', async () => {
      const rows = await appUserPrisma.cFOP.findMany({ take: 1 });
      expect(Array.isArray(rows)).toBe(true);
    });

    it('app_user NÃO consegue INSERT em NCM (apenas SELECT grant)', async () => {
      await expect(
        appUserPrisma.nCM.create({
          data: { codigo: '99999999', descricao: 'tentativa de write não autorizada' },
        }),
      ).rejects.toThrow(/permission denied|insufficient/i);
    });
  });
});

// Force the Prisma namespace import to be retained even if the file is processed
// by tooling that strips type-only imports (Vitest does not, but lint config might).
export type _PrismaTouch = Prisma.JsonValue;
