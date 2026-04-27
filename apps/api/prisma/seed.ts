import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { seedLookups } from './seed-lookups';

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

    // Phase 2 fixtures FK->empresas via tenant_id — limpa em ordem reversa antes
    // de tocar empresas (FK violations bloqueiam empresa.deleteMany() senão).
    await prisma.alertaCertificado.deleteMany();
    await prisma.certificadoDigital.deleteMany();
    await prisma.serieFiscal.deleteMany();
    await prisma.servico.deleteMany();
    await prisma.produto.deleteMany();
    await prisma.fornecedor.deleteMany();
    await prisma.cliente.deleteMany();

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

    // ========================================================================
    // Phase 2 fixtures — clientes / fornecedores / produtos / servicos / series
    // Reusa os 2 tenants A e B já criados acima. UUIDs determinísticos para que
    // a suite cadastros-rls-regression tenha pontos de referência estáveis.
    // ========================================================================
    console.log('[seed] Phase 2 fixtures (clientes, fornecedores, produtos, servicos)');

    const tenantA = UUIDS.empresaA;
    const tenantB = UUIDS.empresaB;

    // Cleanup Phase 2 já foi feito acima (antes de empresa.deleteMany()).
    // Aqui apenas (re)criamos os fixtures via upsert — idempotente.

    // Cliente fixture em A e B (mesmo CNPJ permitido — duplicidade é POR tenant).
    // Usa upsert para idempotência completa do seed.
    await prisma.cliente.upsert({
      where: { tenantId_cpfCnpj: { tenantId: tenantA, cpfCnpj: '12345678000190' } },
      update: {},
      create: {
        id: '55555555-5555-5555-5555-555555555555',
        tenantId: tenantA,
        tipoPessoa: 'juridica',
        cpfCnpj: '12345678000190',
        nome: 'Cliente A1 LTDA',
        endereco: {
          logradouro: 'Av. Paulista',
          numero: '1500',
          bairro: 'Bela Vista',
          cidade: 'São Paulo',
          uf: 'SP',
          cep: '01310100',
        },
      },
    });

    await prisma.cliente.upsert({
      where: { tenantId_cpfCnpj: { tenantId: tenantB, cpfCnpj: '12345678000190' } },
      update: {},
      create: {
        id: '66666666-6666-6666-6666-666666666666',
        tenantId: tenantB,
        tipoPessoa: 'juridica',
        cpfCnpj: '12345678000190',
        nome: 'Cliente B1 LTDA',
        endereco: {
          logradouro: 'Av. Brigadeiro',
          numero: '200',
          bairro: 'Itaim',
          cidade: 'São Paulo',
          uf: 'SP',
          cep: '04543000',
        },
      },
    });

    // Fornecedor fixture em A
    await prisma.fornecedor.upsert({
      where: { tenantId_cpfCnpj: { tenantId: tenantA, cpfCnpj: '11111111000111' } },
      update: {},
      create: {
        tenantId: tenantA,
        cpfCnpj: '11111111000111',
        razaoSocial: 'Fornecedor A LTDA',
        endereco: {
          logradouro: 'R. Industrial',
          numero: '99',
          bairro: 'Distrito',
          cidade: 'Guarulhos',
          uf: 'SP',
          cep: '07000000',
        },
      },
    });

    // Produto fixture em A
    await prisma.produto.upsert({
      where: { tenantId_codigo: { tenantId: tenantA, codigo: 'SKU-001' } },
      update: {},
      create: {
        tenantId: tenantA,
        codigo: 'SKU-001',
        descricao: 'Produto teste A',
        ncm: '12345678',
        unidade: 'UN',
        precoVenda: '10.5000',
        origemMercadoria: 0,
      },
    });

    // Servico fixture em A
    await prisma.servico.upsert({
      where: { tenantId_codigoInterno: { tenantId: tenantA, codigoInterno: 'SVC-001' } },
      update: {},
      create: {
        tenantId: tenantA,
        codigoInterno: 'SVC-001',
        descricao: 'Consultoria contábil',
        codigoMunicipal: '17.01',
        precoPadrao: '500.0000',
        aliquotaIss: '5.00',
      },
    });

    // SerieFiscal em A
    await prisma.serieFiscal.upsert({
      where: { empresaId_modelo_serie: { empresaId: tenantA, modelo: 'NFE_55', serie: 1 } },
      update: {},
      create: {
        tenantId: tenantA,
        empresaId: tenantA,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 1n,
        ambiente: 'HOMOLOGACAO',
      },
    });

    // Phase 2 Plan 02-08 — popula tabelas-lookup (NCM/CEST/CFOP/LC116) a partir
    // de fixtures bootstrap. Idempotente: só insere se a tabela estiver vazia
    // (worker mensal lookup-sync cuida das atualizações posteriores).
    console.log('[seed] Phase 2 lookups (NCM/CEST/CFOP/LC116) bootstrap');
    await seedLookups(prisma);

    console.log('[seed] Concluído.');
    console.log('[seed] UUIDs gerados:', UUIDS);

    // Phase 02.1 — seed do 1º admin platform se nenhum user admin existir
    await seedFirstAdmin(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Cria o primeiro admin de plataforma se nenhum user existir ainda.
 * Roda após o seed de fixtures de dev (tenants A/B) — idempotente.
 *
 * Credenciais padrão: admin@nexofiscal.local / nexo2026
 * TROCAR IMEDIATAMENTE após o primeiro login em /configuracoes/seguranca.
 */
async function seedFirstAdmin(prisma: PrismaClient): Promise<void> {
  // Verifica se já existe algum admin de plataforma (membership scopeType=platform).
  // Em dev, o seed de fixtures já criou users — mas pode não ter admin platform.
  // Em prod/staging DB virgem, nenhum user existe ainda e este bloco cria o primeiro.
  const existingAdmin = await prisma.userMembership.findFirst({
    where: { scopeType: 'platform', role: 'admin' },
  });

  if (existingAdmin) {
    console.log('[seed] Seed auth: admin platform já existe, pulando criação do admin inicial.');
    return;
  }

  const ARGON2_OPTIONS = {
    memoryCost: 65536, // 64 MB — NIST SP 800-63B
    timeCost: 3,
    parallelism: 4,
    outputLen: 32,
  };

  const passwordHash = await hash('nexo2026', ARGON2_OPTIONS);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@nexofiscal.local',
      passwordHash,
      emailVerifiedAt: new Date(),
      passwordChangedAt: new Date(),
    },
  });

  await prisma.userMembership.create({
    data: {
      userId: admin.id,
      scopeType: 'platform',
      scopeId: null,
      role: 'admin',
    },
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('ATENCAO: 1º admin criado automaticamente pelo seed!');
  console.log('  Email:  admin@nexofiscal.local');
  console.log('  Senha:  nexo2026');
  console.log('');
  console.log('  TROQUE A SENHA IMEDIATAMENTE apos o primeiro login');
  console.log('  em /configuracoes/seguranca');
  console.log('='.repeat(60));
  console.log('');
}

main().catch((e: unknown) => {
  console.error('[seed] erro:', e);
  process.exit(1);
});
