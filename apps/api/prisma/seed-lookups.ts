import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * seed-lookups — Plan 02-08 (Phase 2).
 *
 * Popula tabelas-lookup (NCM/CEST/CFOP/LC116) a partir de fixtures JSON
 * bootstrap commitadas no repo. **Idempotente**: se a tabela já tem
 * registros (count > 0), pula o bootstrap e mantém os dados existentes —
 * o worker mensal (lookup-sync) é a fonte de verdade após o primeiro sync.
 *
 * Uso:
 *  - Standalone: `tsx apps/api/prisma/seed-lookups.ts` (com DATABASE_ADMIN_URL)
 *  - Importado: `import { seedLookups } from './seed-lookups'` no seed.ts principal
 *
 * Requer DATABASE_URL apontando para `app_admin` (BYPASSRLS) — Migration 500
 * REVOKEd writes em ncm/cest/cfop/lc116 de `app_user`. O script `db:seed`
 * já configura via cross-env DATABASE_URL=$DATABASE_ADMIN_URL.
 */

interface NCMItem {
  codigo: string;
  descricao: string;
}

interface CESTItem {
  codigo: string;
  descricao: string;
  ncmRelacionado?: string | null;
}

interface CFOPItem {
  codigo: string;
  descricao: string;
  tipo: 'entrada' | 'saida';
}

interface LC116Item {
  codigo: string;
  descricao: string;
}

function loadFixture<T>(name: string): T[] {
  const path = join(__dirname, 'fixtures', name);
  return JSON.parse(readFileSync(path, 'utf-8')) as T[];
}

async function seedNcm(prisma: PrismaClient): Promise<void> {
  const count = await prisma.nCM.count();
  if (count > 0) {
    console.log(`[seed-lookups] NCM já tem ${count} registros — pulando bootstrap`);
    return;
  }
  const items = loadFixture<NCMItem>('ncm-bootstrap.json');
  await prisma.nCM.createMany({
    data: items.map((i) => ({ codigo: i.codigo, descricao: i.descricao })),
    skipDuplicates: true,
  });
  console.log(`[seed-lookups] NCM bootstrap: ${items.length} inseridos`);
}

async function seedCest(prisma: PrismaClient): Promise<void> {
  const count = await prisma.cEST.count();
  if (count > 0) {
    console.log(`[seed-lookups] CEST já tem ${count} registros — pulando bootstrap`);
    return;
  }
  const items = loadFixture<CESTItem>('cest-bootstrap.json');
  await prisma.cEST.createMany({
    data: items.map((i) => ({
      codigo: i.codigo,
      descricao: i.descricao,
      ncmRelacionado: i.ncmRelacionado ?? null,
    })),
    skipDuplicates: true,
  });
  console.log(`[seed-lookups] CEST bootstrap: ${items.length} inseridos`);
}

async function seedCfop(prisma: PrismaClient): Promise<void> {
  const count = await prisma.cFOP.count();
  if (count > 0) {
    console.log(`[seed-lookups] CFOP já tem ${count} registros — pulando bootstrap`);
    return;
  }
  const items = loadFixture<CFOPItem>('cfop-bootstrap.json');
  await prisma.cFOP.createMany({
    data: items.map((i) => ({ codigo: i.codigo, descricao: i.descricao, tipo: i.tipo })),
    skipDuplicates: true,
  });
  console.log(`[seed-lookups] CFOP bootstrap: ${items.length} inseridos`);
}

async function seedLc116(prisma: PrismaClient): Promise<void> {
  const count = await prisma.lC116.count();
  if (count > 0) {
    console.log(`[seed-lookups] LC116 já tem ${count} registros — pulando bootstrap`);
    return;
  }
  const items = loadFixture<LC116Item>('lc116-bootstrap.json');
  await prisma.lC116.createMany({
    data: items.map((i) => ({ codigo: i.codigo, descricao: i.descricao })),
    skipDuplicates: true,
  });
  console.log(`[seed-lookups] LC116 bootstrap: ${items.length} inseridos`);
}

/**
 * Função pública chamada pelo seed.ts principal — recebe a instância
 * Prisma já conectada (sem criar nova conexão duplicada).
 */
export async function seedLookups(prisma: PrismaClient): Promise<void> {
  await seedNcm(prisma);
  await seedCest(prisma);
  await seedCfop(prisma);
  await seedLc116(prisma);
}

// Permite execução standalone para troubleshooting / dev manual.
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedLookups(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Detecta se foi executado diretamente (não importado).
// Compatível com CommonJS (módulo target do tsconfig.json).
if (require.main === module) {
  main().catch((e: unknown) => {
    console.error('[seed-lookups] erro:', e);
    process.exit(1);
  });
}
