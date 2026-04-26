import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BusinessException,
  DuplicateException,
} from '../src/common/business.exception';
import { tenantStore } from '../src/db/tenant-context';
import { SeriesService } from '../src/modules/series/series.service';

/**
 * Suite Plan 02-06 Task 2 — SeriesService CRUD orchestration.
 *
 * Estratégia: mocka PrismaService (sem Postgres up). Cobre:
 *  - create + list dentro do tenant
 *  - duplicidade (mesma empresa+modelo+serie) → DuplicateException
 *  - mesma serie em tenants distintos é PERMITIDA (isolamento)
 *  - assertEnvironmentMatch ENV_MISMATCH 403 (CERT-08)
 *  - PATCH ambiente HOMOLOGACAO → PRODUCAO atualiza
 *  - cross-tenant create rejeitado (T-02-06-03)
 *  - DELETE = soft (ativa=false)
 *  - findOne em outro tenant → 404
 */

const TENANT_A = '33333333-3333-3333-3333-333333333333';
const TENANT_B = '44444444-4444-4444-4444-444444444444';

interface FakeSerieRow {
  id: string;
  tenantId: string;
  empresaId: string;
  modelo: string;
  serie: number;
  proximoNumero: bigint;
  ambiente: string;
  ativa: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function makeFakePrisma(rows: FakeSerieRow[] = []) {
  let counter = 0;
  const serieFiscal = {
    findMany: vi.fn(
      async (args: { where?: { tenantId?: string }; orderBy?: unknown }) => {
        const tid = args.where?.tenantId;
        const out = tid ? rows.filter((r) => r.tenantId === tid) : [...rows];
        // ordena por modelo, depois serie
        out.sort((a, b) => {
          if (a.modelo !== b.modelo) return a.modelo.localeCompare(b.modelo);
          return a.serie - b.serie;
        });
        return out;
      },
    ),
    findFirst: vi.fn(
      async (args: { where?: { id?: string; tenantId?: string } }) => {
        const where = args.where ?? {};
        return (
          rows.find((r) => {
            if (where.id && r.id !== where.id) return false;
            if (where.tenantId && r.tenantId !== where.tenantId) return false;
            return true;
          }) ?? null
        );
      },
    ),
    findUnique: vi.fn(async (args: { where: { id: string } }) => {
      return rows.find((r) => r.id === args.where.id) ?? null;
    }),
    create: vi.fn(
      async (args: {
        data: Omit<FakeSerieRow, 'id' | 'createdAt' | 'updatedAt'>;
      }) => {
        // Simula constraint @@unique([empresaId, modelo, serie])
        const dup = rows.find(
          (r) =>
            r.empresaId === args.data.empresaId &&
            r.modelo === args.data.modelo &&
            r.serie === args.data.serie,
        );
        if (dup) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed',
            {
              code: 'P2002',
              clientVersion: '6.0.0',
              meta: {
                modelName: 'SerieFiscal',
                target: ['empresaId', 'modelo', 'serie'],
              },
            },
          );
        }
        const now = new Date();
        counter += 1;
        const id = `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
        const row: FakeSerieRow = {
          id,
          ...args.data,
          createdAt: now,
          updatedAt: now,
        };
        rows.push(row);
        return row;
      },
    ),
    update: vi.fn(
      async (args: {
        where: { id: string };
        data: Partial<FakeSerieRow>;
      }) => {
        const idx = rows.findIndex((r) => r.id === args.where.id);
        if (idx === -1) throw new Error('not found');
        rows[idx] = {
          ...rows[idx],
          ...args.data,
          updatedAt: new Date(),
        } as FakeSerieRow;
        return rows[idx];
      },
    ),
  };
  return { rows, serieFiscal };
}

function withTenant<T>(
  tenantId: string | null,
  fn: () => Promise<T> | T,
): Promise<T> {
  return Promise.resolve(
    tenantStore.run(
      {
        tenantId,
        contabilidadeId: null,
        userId: null,
        role: 'tenant_user',
      },
      fn,
    ),
  );
}

describe('SeriesService — CRUD', () => {
  let svc: SeriesService;
  let prisma: ReturnType<typeof makeFakePrisma>;

  beforeEach(() => {
    prisma = makeFakePrisma([]);
    svc = new SeriesService(prisma as never);
  });

  it('create + list dentro do tenant', async () => {
    await withTenant(TENANT_A, async () => {
      const created = (await svc.create({
        empresaId: TENANT_A,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 1,
        ambiente: 'HOMOLOGACAO',
      })) as { modelo: string; ambiente: string };
      expect(created.modelo).toBe('NFE_55');
      expect(created.ambiente).toBe('HOMOLOGACAO');

      const list = (await svc.list()) as Array<{ modelo: string }>;
      expect(list).toHaveLength(1);
      expect(list[0]?.modelo).toBe('NFE_55');
    });
  });

  it('duplicidade (mesma empresa+modelo+serie) → DuplicateException 409', async () => {
    await withTenant(TENANT_A, async () => {
      await svc.create({
        empresaId: TENANT_A,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 1,
        ambiente: 'HOMOLOGACAO',
      });
      await expect(
        svc.create({
          empresaId: TENANT_A,
          modelo: 'NFE_55',
          serie: 1,
          proximoNumero: 1,
          ambiente: 'PRODUCAO',
        }),
      ).rejects.toBeInstanceOf(DuplicateException);
    });
  });

  it('mesma serie em tenants distintos é PERMITIDA (isolamento)', async () => {
    await withTenant(TENANT_A, () =>
      svc.create({
        empresaId: TENANT_A,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 1,
        ambiente: 'HOMOLOGACAO',
      }),
    );
    await withTenant(TENANT_B, () =>
      svc.create({
        empresaId: TENANT_B,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 1,
        ambiente: 'HOMOLOGACAO',
      }),
    );
    expect(prisma.rows).toHaveLength(2);
  });

  it('assertEnvironmentMatch lança ENV_MISMATCH 403 se ambientes diferem', () => {
    expect(() =>
      svc.assertEnvironmentMatch({ ambiente: 'HOMOLOGACAO' }, 'PRODUCAO'),
    ).toThrowError(
      expect.objectContaining({
        code: 'ENV_MISMATCH',
        httpStatus: 403,
      }) as never,
    );
  });

  it('assertEnvironmentMatch passa se ambientes batem', () => {
    expect(() =>
      svc.assertEnvironmentMatch({ ambiente: 'PRODUCAO' }, 'PRODUCAO'),
    ).not.toThrow();
    expect(() =>
      svc.assertEnvironmentMatch({ ambiente: 'HOMOLOGACAO' }, 'HOMOLOGACAO'),
    ).not.toThrow();
  });

  it('PATCH ambiente HOMOLOGACAO → PRODUCAO atualiza', async () => {
    await withTenant(TENANT_A, async () => {
      const created = (await svc.create({
        empresaId: TENANT_A,
        modelo: 'NFSE',
        serie: 1,
        proximoNumero: 1,
        ambiente: 'HOMOLOGACAO',
      })) as { id: string };
      const updated = (await svc.update(created.id, {
        ambiente: 'PRODUCAO',
      })) as { ambiente: string };
      expect(updated.ambiente).toBe('PRODUCAO');
    });
  });

  it('cross-tenant create rejeitado (T-02-06-03) — empresaId !== tenantId', async () => {
    await withTenant(TENANT_A, async () => {
      await expect(
        svc.create({
          empresaId: TENANT_B,
          modelo: 'NFE_55',
          serie: 1,
          proximoNumero: 1,
          ambiente: 'HOMOLOGACAO',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    expect(prisma.rows).toHaveLength(0);
  });

  it('create sem tenant ativo lança NO_TENANT', async () => {
    await withTenant(null, async () => {
      await expect(
        svc.create({
          empresaId: TENANT_A,
          modelo: 'NFE_55',
          serie: 1,
          proximoNumero: 1,
          ambiente: 'HOMOLOGACAO',
        }),
      ).rejects.toMatchObject({ code: 'NO_TENANT' });
    });
  });

  it('list sem tenant retorna []', async () => {
    await withTenant(null, async () => {
      const list = await svc.list();
      expect(list).toEqual([]);
    });
  });

  it('DELETE = soft (ativa=false), não remove a linha', async () => {
    await withTenant(TENANT_A, async () => {
      const created = (await svc.create({
        empresaId: TENANT_A,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 1,
        ambiente: 'HOMOLOGACAO',
      })) as { id: string };
      await svc.remove(created.id);
      // Linha persiste
      expect(prisma.rows).toHaveLength(1);
      expect(prisma.rows[0]?.ativa).toBe(false);
    });
  });

  it('findOne em outro tenant retorna 404', async () => {
    // Cria série em tenant A
    let createdId: string | undefined;
    await withTenant(TENANT_A, async () => {
      const created = (await svc.create({
        empresaId: TENANT_A,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 1,
        ambiente: 'HOMOLOGACAO',
      })) as { id: string };
      createdId = created.id;
    });
    // Tenta acessar do tenant B
    await withTenant(TENANT_B, async () => {
      await expect(svc.findOne(createdId as string)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  it('serialize converte BigInt proximoNumero para string', async () => {
    await withTenant(TENANT_A, async () => {
      const created = (await svc.create({
        empresaId: TENANT_A,
        modelo: 'NFE_55',
        serie: 1,
        proximoNumero: 999_999_999,
        ambiente: 'HOMOLOGACAO',
      })) as { proximoNumero: unknown };
      expect(typeof created.proximoNumero).toBe('string');
      expect(created.proximoNumero).toBe('999999999');
      // JSON-safety — não lança ao serializar
      expect(() => JSON.stringify(created)).not.toThrow();
    });
  });
});

// Garante que ambiente type-safety está intacta (sanity)
describe('SeriesService — type contracts', () => {
  it('BusinessException ENV_MISMATCH carrega details estruturados', () => {
    try {
      const svc = new SeriesService({} as never);
      svc.assertEnvironmentMatch({ ambiente: 'HOMOLOGACAO' }, 'PRODUCAO');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BusinessException);
      const be = err as BusinessException;
      expect(be.code).toBe('ENV_MISMATCH');
      expect(be.httpStatus).toBe(403);
      expect(be.details).toMatchObject({
        serieAmbiente: 'HOMOLOGACAO',
        requestedEnv: 'PRODUCAO',
      });
    }
  });
});
