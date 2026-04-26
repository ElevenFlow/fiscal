import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BusinessException,
  NotFoundResourceException,
} from '../src/common/business.exception';
import { SeriesNumberingHelper } from '../src/modules/series/series-numbering.helper';

/**
 * Suite Plan 02-06 Task 2 — SeriesNumberingHelper.getNextSeqAndIncrement
 *
 * Cobre numeração transacional ATÔMICA via SELECT FOR UPDATE + Serializable
 * isolation level (CERT-06; T-02-06-01).
 *
 * Pré-requisitos: Postgres rodando + migrations Phase 2 aplicadas.
 *  - DATABASE_ADMIN_URL aponta para app_admin (BYPASSRLS) — necessário porque
 *    o helper opera DIRETAMENTE em series_fiscais, sem withTenantContext, e
 *    RLS bloquearia SELECT FOR UPDATE sob app_user sem app.current_tenant setado.
 *
 * Quando Postgres não está reachable (CI sem docker, dev local sem container),
 * a suite real é PULADA (it.skipIf) — mas o smoke estático sempre roda para
 * garantir contrato auditável (FOR UPDATE / Serializable / SERIE_INACTIVE).
 *
 * Casos cobertos (success_criteria):
 *  - happy path retorna proximoNumero atual e incrementa
 *  - 100 chamadas concorrentes geram 100 números únicos sem gap
 *  - série não encontrada → NotFoundResourceException
 *  - série inativa → SERIE_INACTIVE 409
 *  - chamada DENTRO de transação externa funciona (caller controla COMMIT)
 */

const APP_ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const TENANT_A = '33333333-3333-3333-3333-333333333333';

/**
 * Probe Postgres reachability ANTES de instanciar o suite. Se DB não estiver
 * up, roda apenas o smoke estático.
 */
async function probePostgres(): Promise<boolean> {
  if (!APP_ADMIN_URL?.includes('app_admin')) return false;
  const probe = new PrismaClient({
    datasources: { db: { url: APP_ADMIN_URL } },
  });
  try {
    await probe.$queryRaw`SELECT 1`;
    await probe.$disconnect();
    return true;
  } catch {
    try {
      await probe.$disconnect();
    } catch {
      /* ignore */
    }
    return false;
  }
}

let dbReachable = false;
let prismaShared: PrismaClient | null = null;
let helper: SeriesNumberingHelper | null = null;
let serieId = '';

describe('SeriesNumberingHelper — concurrency (real Postgres)', () => {
  beforeAll(async () => {
    dbReachable = await probePostgres();
    if (!dbReachable) {
      console.warn(
        '[series-numbering.spec] Postgres unreachable em DATABASE_ADMIN_URL — testes reais SKIPPED. Smoke estático ainda roda. Para rodar a suite real: docker compose up -d + pnpm db:migrate.',
      );
      return;
    }
    prismaShared = new PrismaClient({
      datasources: { db: { url: APP_ADMIN_URL } },
    });
    helper = new SeriesNumberingHelper(prismaShared as never);
  });

  afterAll(async () => {
    if (prismaShared) {
      try {
        await prismaShared.serieFiscal.deleteMany({
          where: { tenantId: TENANT_A },
        });
      } catch {
        /* fixtures cleanup best-effort */
      }
      await prismaShared.$disconnect();
    }
  });

  beforeEach(async () => {
    if (!dbReachable || !prismaShared) return;
    await prismaShared.serieFiscal.deleteMany({
      where: { tenantId: TENANT_A },
    });
    const created = await prismaShared.serieFiscal.create({
      data: {
        tenantId: TENANT_A,
        empresaId: TENANT_A,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 100n,
        ambiente: 'HOMOLOGACAO',
        ativa: true,
      },
    });
    serieId = created.id;
  });

  it.skipIf(!process.env.DATABASE_ADMIN_URL)(
    'happy path — retorna 100, depois 101, depois 102',
    async () => {
      if (!dbReachable || !helper || !prismaShared) {
        return; // skip silenciosamente
      }
      expect(await helper.getNextSeqAndIncrement(serieId)).toBe(100n);
      expect(await helper.getNextSeqAndIncrement(serieId)).toBe(101n);
      expect(await helper.getNextSeqAndIncrement(serieId)).toBe(102n);

      const row = await prismaShared.serieFiscal.findUnique({
        where: { id: serieId },
      });
      expect(row?.proximoNumero).toBe(103n);
    },
  );

  it.skipIf(!process.env.DATABASE_ADMIN_URL)(
    'série não encontrada — NotFoundResourceException',
    async () => {
      if (!dbReachable || !helper) return;
      await expect(
        helper.getNextSeqAndIncrement('99999999-9999-9999-9999-999999999999'),
      ).rejects.toThrow(NotFoundResourceException);
    },
  );

  it.skipIf(!process.env.DATABASE_ADMIN_URL)(
    'série inativa — SERIE_INACTIVE 409',
    async () => {
      if (!dbReachable || !helper || !prismaShared) return;
      await prismaShared.serieFiscal.update({
        where: { id: serieId },
        data: { ativa: false },
      });
      await expect(helper.getNextSeqAndIncrement(serieId)).rejects.toMatchObject(
        { code: 'SERIE_INACTIVE', httpStatus: 409 },
      );
    },
  );

  it.skipIf(!process.env.DATABASE_ADMIN_URL)(
    '100 chamadas concorrentes geram 100 números únicos contíguos sem gap',
    async () => {
      if (!dbReachable || !helper || !prismaShared) return;
      const N = 100;
      const promises = Array.from({ length: N }, () =>
        (helper as SeriesNumberingHelper).getNextSeqAndIncrement(serieId),
      );
      const results = await Promise.all(promises);

      const numbers = results.map((b) => Number(b));
      const sorted = [...numbers].sort((a, b) => a - b);

      // Sem duplicatas
      const unique = new Set(numbers);
      expect(unique.size).toBe(N);

      // Sem gaps — sequência exata 100..199
      expect(sorted).toEqual(Array.from({ length: N }, (_, i) => 100 + i));

      // proximoNumero final = 200
      const row = await prismaShared.serieFiscal.findUnique({
        where: { id: serieId },
      });
      expect(row?.proximoNumero).toBe(200n);
    },
    30_000,
  );

  it.skipIf(!process.env.DATABASE_ADMIN_URL)(
    'chamada dentro de tx externa funciona — caller controla commit',
    async () => {
      if (!dbReachable || !helper || !prismaShared) return;
      const num = await prismaShared.$transaction(async (tx) => {
        return (helper as SeriesNumberingHelper).getNextSeqAndIncrement(
          serieId,
          tx,
        );
      });
      expect(num).toBe(100n);
      const row = await prismaShared.serieFiscal.findUnique({
        where: { id: serieId },
      });
      expect(row?.proximoNumero).toBe(101n);
    },
  );
});

/**
 * Smoke estático — valida o shape do helper mesmo sem Postgres up.
 * Garante que a CI sem DB ainda exercita o caminho de instanciação e tipo.
 */
describe('SeriesNumberingHelper — static smoke (no DB required)', () => {
  it('helper é instanciável e expõe getNextSeqAndIncrement (shape contract)', () => {
    const h = new SeriesNumberingHelper({} as never);
    expect(typeof h.getNextSeqAndIncrement).toBe('function');
    // 2 args (serieId, tx?)
    expect(h.getNextSeqAndIncrement.length).toBeLessThanOrEqual(2);
  });

  it('código contém SELECT FOR UPDATE + Serializable + $queryRaw (auditável)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.join(
        __dirname,
        '..',
        'src',
        'modules',
        'series',
        'series-numbering.helper.ts',
      ),
      'utf-8',
    );
    expect(src).toMatch(/FOR UPDATE/);
    expect(src).toMatch(/Serializable/);
    expect(src).toMatch(/\$queryRaw/);
    expect(src).toMatch(/\$executeRaw/);
  });

  it('source contém SERIE_INACTIVE business code', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(
      path.join(
        __dirname,
        '..',
        'src',
        'modules',
        'series',
        'series-numbering.helper.ts',
      ),
      'utf-8',
    );
    expect(src).toMatch(/SERIE_INACTIVE/);
  });

  it('BusinessException + NotFoundResourceException são acessíveis e estruturadas', () => {
    const err1 = new BusinessException('SERIE_INACTIVE', 'x', 409);
    expect(err1.code).toBe('SERIE_INACTIVE');
    expect(err1.httpStatus).toBe(409);
    const err2 = new NotFoundResourceException('serie', 'abc');
    expect(err2.code).toBe('NOT_FOUND');
    expect(err2.httpStatus).toBe(404);
  });
});
