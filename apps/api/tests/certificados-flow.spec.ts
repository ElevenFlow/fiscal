import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { CertificadosService } from '../src/modules/certificados/certificados.service';
import { PfxParserService } from '../src/modules/certificados/pfx-parser.service';
import { KmsEnvelopeService } from '../src/modules/storage/kms-envelope.service';
import { tenantStore } from '../src/db/tenant-context';

/**
 * Suite Plan 02-04 — orquestração CertificadosService.
 *
 * Estratégia: mocka PrismaService + S3Service (não exige Postgres ou AWS),
 * usa KmsEnvelopeService real em modo dev fallback (DEV_MASTER_KEY) +
 * PfxParserService real com fixture .pfx auto-assinado.
 *
 * Cobre happy path + 8 cenários de erro identificados em <success_criteria>.
 */

const FIXTURE_PATH = join(__dirname, 'fixtures', 'test-cert.pfx');
const PASSWORD = 'test1234';
const TENANT_A = '33333333-3333-3333-3333-333333333333';
const TENANT_B = '44444444-4444-4444-4444-444444444444';
const USER_ID = '55555555-5555-5555-5555-555555555555';

interface FakeRow {
  id: string;
  tenantId: string;
  fingerprint: string;
  cn: string;
  cnpjCertificado: string;
  notBefore: Date;
  notAfter: Date;
  ativo: boolean;
  s3Key: string;
  s3VersionId: string;
  encryptedDek: Uint8Array;
  kmsKeyId: string;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeFakePrisma(rows: FakeRow[] = []) {
  const certificadoDigital = {
    findFirst: vi.fn((args: { where?: Partial<FakeRow> & { ativo?: boolean } }) => {
      const where = args.where ?? {};
      const found = rows.find((r) => {
        if (where.id && r.id !== where.id) return false;
        if (where.tenantId && r.tenantId !== where.tenantId) return false;
        if (where.fingerprint && r.fingerprint !== where.fingerprint) return false;
        if (where.ativo !== undefined && r.ativo !== where.ativo) return false;
        return true;
      });
      return Promise.resolve(found ?? null);
    }),
    findMany: vi.fn((args: { where?: { tenantId?: string } }) => {
      const tid = args.where?.tenantId;
      const out = tid ? rows.filter((r) => r.tenantId === tid) : [...rows];
      out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return Promise.resolve(out);
    }),
    updateMany: vi.fn((args: { where: { tenantId: string; ativo: boolean }; data: { ativo: boolean } }) => {
      let count = 0;
      for (const r of rows) {
        if (
          r.tenantId === args.where.tenantId &&
          r.ativo === args.where.ativo
        ) {
          r.ativo = args.data.ativo;
          count++;
        }
      }
      return Promise.resolve({ count });
    }),
    update: vi.fn((args: { where: { id: string }; data: Partial<FakeRow> }) => {
      const idx = rows.findIndex((r) => r.id === args.where.id);
      if (idx === -1) throw new Error('not found');
      rows[idx] = { ...rows[idx], ...args.data, updatedAt: new Date() };
      return Promise.resolve(rows[idx]);
    }),
    create: vi.fn((args: { data: Omit<FakeRow, 'createdAt' | 'updatedAt'> }) => {
      const now = new Date();
      const row: FakeRow = {
        ...args.data,
        createdAt: now,
        updatedAt: now,
      } as FakeRow;
      rows.push(row);
      return Promise.resolve(row);
    }),
  };

  return {
    rows,
    certificadoDigital,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ certificadoDigital }),
    ),
  };
}

function makeFakeS3() {
  return {
    uploadCertificate: vi.fn().mockResolvedValue({
      key: 'tenants/mock/certs/mock.pfx.enc',
      versionId: 'v-mock',
    }),
  };
}

describe('CertificadosService — orchestration', () => {
  let svc: CertificadosService;
  let parser: PfxParserService;
  let kms: KmsEnvelopeService;
  let prisma: ReturnType<typeof makeFakePrisma>;
  let s3: ReturnType<typeof makeFakeS3>;
  let pfxBytes: Buffer;

  beforeAll(() => {
    process.env.KMS_CERT_KEY_ID = '';
    process.env.DEV_MASTER_KEY = randomBytes(32).toString('hex');
    process.env.NODE_ENV = 'development';
    parser = new PfxParserService();
    kms = new KmsEnvelopeService();
    kms.onModuleInit();
  });

  beforeEach(() => {
    prisma = makeFakePrisma([]);
    s3 = makeFakeS3();
    svc = new CertificadosService(
      prisma as never,
      s3 as never,
      kms,
      parser,
    );
    // Re-read fresh bytes a cada test (uploadCertificate faz fill(0))
    pfxBytes = readFileSync(FIXTURE_PATH);
  });

  function withTenant<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T> {
    return tenantStore.run(
      {
        tenantId,
        contabilidadeId: null,
        userId: USER_ID,
        role: 'tenant_user',
      },
      fn,
    );
  }

  it('happy path — upload .pfx fixture cifra, S3 mock recebe, DB recebe metadata', async () => {
    const result = await withTenant(TENANT_A, () =>
      svc.uploadCertificate(pfxBytes, PASSWORD),
    );

    expect(result).toMatchObject({
      cn: expect.stringContaining('NEXO TESTE'),
      cnpjCertificado: '11222333000181',
      ativo: true,
      kmsKeyId: 'dev-fallback',
    });
    expect((result as { fingerprint: string }).fingerprint).toMatch(/^[a-f0-9]{64}$/);

    expect(s3.uploadCertificate).toHaveBeenCalledTimes(1);
    expect(s3.uploadCertificate.mock.calls[0]?.[0]).toMatchObject({
      tenantId: TENANT_A,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]?.tenantId).toBe(TENANT_A);
    expect(prisma.rows[0]?.ativo).toBe(true);
  });

  it('upload > 100KB rejeitado com FILE_TOO_LARGE (sem chamar S3 nem KMS)', async () => {
    const big = Buffer.alloc(200 * 1024);
    await expect(
      withTenant(TENANT_A, () => svc.uploadCertificate(big, PASSWORD)),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(s3.uploadCertificate).not.toHaveBeenCalled();
    expect(prisma.rows).toHaveLength(0);
  });

  it('senha errada lança INVALID_PFX_PASSWORD — não cria linha em DB', async () => {
    await expect(
      withTenant(TENANT_A, () => svc.uploadCertificate(pfxBytes, 'wrong')),
    ).rejects.toMatchObject({ code: 'INVALID_PFX_PASSWORD' });
    expect(s3.uploadCertificate).not.toHaveBeenCalled();
    expect(prisma.rows).toHaveLength(0);
  });

  it('upload duplicado (mesmo fingerprint) lança DuplicateException', async () => {
    await withTenant(TENANT_A, () => svc.uploadCertificate(pfxBytes, PASSWORD));
    expect(prisma.rows).toHaveLength(1);

    // Re-read bytes: fixture intacto
    const fresh = readFileSync(FIXTURE_PATH);
    await expect(
      withTenant(TENANT_A, () => svc.uploadCertificate(fresh, PASSWORD)),
    ).rejects.toMatchObject({ code: 'DUPLICATE_RESOURCE' });
    expect(prisma.rows).toHaveLength(1); // não cria 2ª linha
  });

  it('mesmo cert em tenant diferente é PERMITIDO (isolamento)', async () => {
    await withTenant(TENANT_A, () => svc.uploadCertificate(pfxBytes, PASSWORD));
    const fresh = readFileSync(FIXTURE_PATH);
    const out = await withTenant(TENANT_B, () =>
      svc.uploadCertificate(fresh, PASSWORD),
    );
    expect(out).toMatchObject({ cnpjCertificado: '11222333000181' });
    expect(prisma.rows).toHaveLength(2);
  });

  it('sem tenant ativo lança NO_TENANT (não chama parser nem KMS)', async () => {
    await expect(
      withTenant(null, () => svc.uploadCertificate(pfxBytes, PASSWORD)),
    ).rejects.toMatchObject({ code: 'NO_TENANT' });
    expect(s3.uploadCertificate).not.toHaveBeenCalled();
  });

  it('listCertificates filtra por tenantId — só vê do tenant atual', async () => {
    await withTenant(TENANT_A, () => svc.uploadCertificate(pfxBytes, PASSWORD));

    const aList = await withTenant(TENANT_A, () => svc.listCertificates());
    expect(aList).toHaveLength(1);

    const bList = await withTenant(TENANT_B, () => svc.listCertificates());
    expect(bList).toHaveLength(0);
  });

  it('deactivateCertificate seta ativo=false (soft delete)', async () => {
    const row = (await withTenant(TENANT_A, () =>
      svc.uploadCertificate(pfxBytes, PASSWORD),
    )) as { id: string };
    await withTenant(TENANT_A, () => svc.deactivateCertificate(row.id));
    expect(prisma.rows[0]?.ativo).toBe(false);
  });

  it('assertCertificadoValido happy path retorna cert ativo + não vencido', async () => {
    await withTenant(TENANT_A, () => svc.uploadCertificate(pfxBytes, PASSWORD));
    const cert = await svc.assertCertificadoValido(TENANT_A);
    expect(cert.tenantId).toBe(TENANT_A);
    expect(cert.ativo).toBe(true);
    expect(cert.notAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('assertCertificadoValido sem cert ativo lança CERT_NOT_FOUND (412)', async () => {
    await expect(svc.assertCertificadoValido(TENANT_A)).rejects.toMatchObject({
      code: 'CERT_NOT_FOUND',
      httpStatus: 412,
    });
  });

  it('assertCertificadoValido em cert vencido lança CERT_EXPIRED (412)', async () => {
    await withTenant(TENANT_A, () => svc.uploadCertificate(pfxBytes, PASSWORD));
    // Manipula direto a row mockada para simular cert vencido
    const row = prisma.rows[0];
    if (row) row.notAfter = new Date(Date.now() - 86400_000); // ontem
    await expect(svc.assertCertificadoValido(TENANT_A)).rejects.toMatchObject({
      code: 'CERT_EXPIRED',
      httpStatus: 412,
    });
  });

  it('upload novo desativa anterior — só 1 ativo por tenant após 2 uploads', async () => {
    // 1º upload
    await withTenant(TENANT_A, () => svc.uploadCertificate(pfxBytes, PASSWORD));
    expect(prisma.rows.filter((r) => r.tenantId === TENANT_A && r.ativo)).toHaveLength(1);

    // Simula 2º cert via parser stub (fingerprint diferente para evitar duplicate)
    const parserSpy = vi
      .spyOn(parser, 'parsePfx')
      .mockReturnValueOnce({
        cn: 'NEXO TESTE 2:11222333000181',
        cnpjCertificado: '11222333000181',
        fingerprint: 'b'.repeat(64),
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 365 * 86400_000),
      });
    const fresh = readFileSync(FIXTURE_PATH);
    await withTenant(TENANT_A, () => svc.uploadCertificate(fresh, PASSWORD));
    parserSpy.mockRestore();

    const ativos = prisma.rows.filter((r) => r.tenantId === TENANT_A && r.ativo);
    expect(ativos).toHaveLength(1);
    expect(ativos[0]?.fingerprint).toBe('b'.repeat(64));

    const inativos = prisma.rows.filter((r) => r.tenantId === TENANT_A && !r.ativo);
    expect(inativos).toHaveLength(1);
  });

  it('KMS round-trip implícito — bytes cifrados podem ser decifrados de volta', async () => {
    const result = (await withTenant(TENANT_A, () =>
      svc.uploadCertificate(pfxBytes, PASSWORD),
    )) as { id: string };

    // Recupera o ciphertext que foi enviado ao S3 (mock)
    const s3Args = s3.uploadCertificate.mock.calls[0]?.[0] as
      | { encryptedBytes: Buffer }
      | undefined;
    expect(s3Args).toBeDefined();
    const ciphertext = s3Args?.encryptedBytes as Buffer;

    // Recupera encryptedDek persistida
    const row = prisma.rows.find((r) => r.id === result.id);
    expect(row).toBeDefined();
    const encryptedDek = Buffer.from(row?.encryptedDek as Uint8Array);

    // Decifra usando o mesmo encryption context
    const back = await kms.decryptEnvelope(ciphertext, encryptedDek, {
      tenantId: TENANT_A,
      purpose: 'pfx',
    });
    // O service zerou o pfxBytes após uso (Buffer.fill(0)), por isso re-lemos
    // do fixture para comparar.
    const original = readFileSync(FIXTURE_PATH);
    expect(back.equals(original)).toBe(true);
  });
});
