import { PrismaClient } from '@prisma/client';

/**
 * Seed determinístico — Nexo Fiscal (Plan 01-04)
 *
 * Cria 2 empresas (tenants A e B), 1 contabilidade ligada às 2, 1 usuário.
 * Usado pela suite de regressão RLS (tests/rls-regression.test.ts) e para
 * dev manual.
 *
 * Requer DATABASE_URL apontando para app_admin (BYPASSRLS) — script npm
 * `db:seed` seta DATABASE_URL=DATABASE_ADMIN_URL via cross-env.
 */

const UUIDS = {
  userTest: '11111111-1111-1111-1111-111111111111',
  contabilidade: '22222222-2222-2222-2222-222222222222',
  empresaA: '33333333-3333-3333-3333-333333333333',
  empresaB: '44444444-4444-4444-4444-444444444444',
} as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    console.log('[seed] Limpando dados existentes...');
    await prisma.auditLog.deleteMany().catch((e: unknown) => {
      // Trigger bloqueia DELETE em produção, mas seed roda com app_admin (BYPASSRLS).
      // Se mesmo assim falhar (trigger dispara com owner), fazemos TRUNCATE das partições.
      console.warn('[seed] auditLog.deleteMany falhou, tentando TRUNCATE CASCADE:', e);
    });
    // TRUNCATE da particionada pai bypassa trigger (trigger é ROW-level, TRUNCATE não dispara)
    await prisma.$executeRawUnsafe('TRUNCATE TABLE audit_log CASCADE');
    await prisma.userMembership.deleteMany();
    await prisma.contabilidadeEmpresa.deleteMany();
    await prisma.empresa.deleteMany();
    await prisma.contabilidade.deleteMany();
    await prisma.user.deleteMany();

    console.log('[seed] Criando user de teste...');
    await prisma.user.create({
      data: {
        id: UUIDS.userTest,
        email: 'teste@nexofiscal.local',
      },
    });

    console.log('[seed] Criando Contabilidade Exemplo...');
    await prisma.contabilidade.create({
      data: {
        id: UUIDS.contabilidade,
        nome: 'Contabilidade Exemplo',
        // CNPJ válido de teste (Receita Federal — raiz padrão de exemplo)
        cnpj: '00000000000191',
      },
    });

    console.log('[seed] Criando Empresa A (tenant A)...');
    // tenant_id será auto-setado igual a id via trigger empresa_tenant_id_before_insert
    await prisma.empresa.create({
      data: {
        id: UUIDS.empresaA,
        tenantId: UUIDS.empresaA,
        razaoSocial: 'Empresa A LTDA',
        cnpj: '11222333000181',
        regimeTributario: 'simples_nacional',
      },
    });

    console.log('[seed] Criando Empresa B (tenant B)...');
    await prisma.empresa.create({
      data: {
        id: UUIDS.empresaB,
        tenantId: UUIDS.empresaB,
        razaoSocial: 'Empresa B S/A',
        cnpj: '44555666000199',
        regimeTributario: 'lucro_presumido',
      },
    });

    console.log('[seed] Vinculando contabilidade às duas empresas...');
    await prisma.contabilidadeEmpresa.createMany({
      data: [
        { contabilidadeId: UUIDS.contabilidade, empresaId: UUIDS.empresaA },
        { contabilidadeId: UUIDS.contabilidade, empresaId: UUIDS.empresaB },
      ],
    });

    console.log('[seed] Criando memberships...');
    await prisma.userMembership.createMany({
      data: [
        {
          userId: UUIDS.userTest,
          scopeType: 'contabilidade',
          scopeId: UUIDS.contabilidade,
          role: 'contabilidade_owner',
        },
      ],
    });

    console.log('[seed] Concluído.');
    console.log('[seed] UUIDs gerados:', UUIDS);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error('[seed] erro:', e);
  process.exit(1);
});
