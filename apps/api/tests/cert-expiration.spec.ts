import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CertExpirationService,
  computeTier,
  daysBetween,
} from '../src/modules/certificados/cert-expiration.service';

/**
 * Suite Plan 02-05 — CertExpirationService
 *
 * Cobre:
 *  1. computeTier — tabela exaustiva de classificação D-60..D-0 + fora-da-janela.
 *  2. daysBetween — sanity para datas em diferentes TZs (sa-east-1 = -03:00).
 *  3. CertExpirationService.runOnce — uses Prisma mock (cross-tenant cron, sem
 *     RLS/withTenantContext do request scope; varredura é "platform_admin").
 *     Cobre:
 *       - cria alerta D-30 quando cert vence em 25 dias
 *       - idempotência: 2x runOnce no mesmo dia → 1 linha
 *       - cert vencido → D-0 / blocking
 *       - cert ativo=false → não gera
 *       - cert >60d (fora janela) → não gera
 *       - múltiplos certs em tenants diferentes → cada um gera só seu alerta
 *
 * Estratégia de mock: PrismaService falso com findMany/upsert in-memory que
 * respeita @@unique([certificadoId, tier]) — mesmo input duas vezes retorna a
 * mesma row e não duplica. Isso replica a invariância do banco para o teste.
 */

interface FakeCert {
  id: string;
  tenantId: string;
  notAfter: Date;
  cnpjCertificado: string;
  ativo: boolean;
}

interface FakeAlerta {
  id: string;
  tenantId: string;
  certificadoId: string;
  tier: string;
  severity: string;
  diasRestantes: number;
  geradoEm: Date;
  resolvido: boolean;
  resolvidoEm: Date | null;
}

function makeFakePrisma(certs: FakeCert[], alertas: FakeAlerta[]) {
  const certificadoDigital = {
    findMany: vi.fn((args: { where?: { ativo?: boolean }; select?: unknown }) => {
      const ativo = args.where?.ativo;
      const out = certs.filter((c) => (ativo === undefined ? true : c.ativo === ativo));
      return Promise.resolve(out);
    }),
  };

  const alertaCertificado = {
    findFirst: vi.fn(
      (args: { where?: { certificadoId?: string; tier?: string } }) => {
        const w = args.where ?? {};
        const found = alertas.find((a) => {
          if (w.certificadoId && a.certificadoId !== w.certificadoId) return false;
          if (w.tier && a.tier !== w.tier) return false;
          return true;
        });
        return Promise.resolve(found ?? null);
      },
    ),
    upsert: vi.fn(
      (args: {
        where: { certificadoId_tier: { certificadoId: string; tier: string } };
        create: Omit<FakeAlerta, 'id' | 'geradoEm' | 'resolvido' | 'resolvidoEm'>;
        update: Partial<FakeAlerta>;
      }) => {
        const key = args.where.certificadoId_tier;
        const existing = alertas.find(
          (a) => a.certificadoId === key.certificadoId && a.tier === key.tier,
        );
        if (existing) {
          Object.assign(existing, args.update);
          return Promise.resolve(existing);
        }
        const row: FakeAlerta = {
          id: `alerta-${alertas.length + 1}`,
          ...args.create,
          geradoEm: new Date(),
          resolvido: false,
          resolvidoEm: null,
        } as FakeAlerta;
        alertas.push(row);
        return Promise.resolve(row);
      },
    ),
    findMany: vi.fn((args?: { where?: { tenantId?: string } }) => {
      const tid = args?.where?.tenantId;
      const out = tid ? alertas.filter((a) => a.tenantId === tid) : [...alertas];
      return Promise.resolve(out);
    }),
    deleteMany: vi.fn(() => {
      const count = alertas.length;
      alertas.length = 0;
      return Promise.resolve({ count });
    }),
  };

  return {
    certificadoDigital,
    alertaCertificado,
  };
}

describe('computeTier — classificação D-60..D-0 por dias restantes', () => {
  // 19 cenários — fora-da-janela, fronteiras, dentro de cada faixa, vencidos.
  it.each<[number, ReturnType<typeof computeTier>]>([
    [120, null],
    [61, null],
    [60, { tier: 'D-60', severity: 'info' }],
    [45, { tier: 'D-60', severity: 'info' }],
    [31, { tier: 'D-60', severity: 'info' }],
    [30, { tier: 'D-30', severity: 'warning' }],
    [20, { tier: 'D-30', severity: 'warning' }],
    [16, { tier: 'D-30', severity: 'warning' }],
    [15, { tier: 'D-15', severity: 'critical' }],
    [10, { tier: 'D-15', severity: 'critical' }],
    [8, { tier: 'D-15', severity: 'critical' }],
    [7, { tier: 'D-7', severity: 'critical' }],
    [3, { tier: 'D-7', severity: 'critical' }],
    [1, { tier: 'D-7', severity: 'critical' }],
    [0, { tier: 'D-0', severity: 'blocking' }],
    [-1, { tier: 'D-0', severity: 'blocking' }],
    [-365, { tier: 'D-0', severity: 'blocking' }],
    [-730, { tier: 'D-0', severity: 'blocking' }],
    [-1000, null],
  ])('days=%i → %o', (days, expected) => {
    expect(computeTier(days)).toEqual(expected);
  });
});

describe('daysBetween — sanity em horários extremos', () => {
  it('zero quando datas idênticas', () => {
    const now = new Date('2026-04-26T12:00:00Z');
    expect(daysBetween(now, now)).toBe(0);
  });

  it('1 dia inteiro entre +24h', () => {
    const a = new Date('2026-04-26T00:00:00Z');
    const b = new Date('2026-04-27T00:00:00Z');
    expect(daysBetween(a, b)).toBe(1);
  });

  it('valor negativo quando "to" é no passado', () => {
    const a = new Date('2026-04-26T12:00:00Z');
    const b = new Date('2026-04-25T12:00:00Z');
    expect(daysBetween(a, b)).toBe(-1);
  });

  it('15 dias para cert vencendo em 15d', () => {
    const now = new Date('2026-04-26T00:00:00Z');
    const notAfter = new Date('2026-05-11T00:00:00Z');
    expect(daysBetween(now, notAfter)).toBe(15);
  });
});

describe('CertExpirationService.runOnce — varredura idempotente', () => {
  const tenantA = '33333333-3333-3333-3333-333333333333';
  const tenantB = '44444444-4444-4444-4444-444444444444';
  let certs: FakeCert[];
  let alertas: FakeAlerta[];
  let prisma: ReturnType<typeof makeFakePrisma>;
  let svc: CertExpirationService;

  beforeEach(() => {
    certs = [];
    alertas = [];
    prisma = makeFakePrisma(certs, alertas);
    svc = new CertExpirationService(prisma as never);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('cert vence em 25 dias → cria 1 alerta D-30 / warning', async () => {
    const now = new Date('2026-04-26T03:00:00-03:00');
    certs.push({
      id: 'cert-1',
      tenantId: tenantA,
      notAfter: new Date(now.getTime() + 25 * 86_400_000),
      cnpjCertificado: '11222333000181',
      ativo: true,
    });

    const r = await svc.runOnce(now);
    expect(r.processed).toBe(1);
    expect(r.alertsCreated).toBe(1);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.tier).toBe('D-30');
    expect(alertas[0]?.severity).toBe('warning');
    expect(alertas[0]?.tenantId).toBe(tenantA);
    expect(alertas[0]?.certificadoId).toBe('cert-1');
    expect(alertas[0]?.diasRestantes).toBe(25);
  });

  it('idempotência — runOnce 2x no mesmo dia não duplica', async () => {
    const now = new Date('2026-04-26T03:00:00-03:00');
    certs.push({
      id: 'cert-2',
      tenantId: tenantA,
      notAfter: new Date(now.getTime() + 5 * 86_400_000), // D-7 tier
      cnpjCertificado: '11222333000181',
      ativo: true,
    });

    await svc.runOnce(now);
    const second = await svc.runOnce(now);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.tier).toBe('D-7');
    // 2ª run não cria nada novo (alertsCreated do 2º depende da heurística — o
    // que importa é o tamanho do array)
    expect(prisma.alertaCertificado.upsert).toHaveBeenCalledTimes(2);
    expect(second.processed).toBe(1);
  });

  it('cert vencido (notAfter no passado) → alerta D-0 / blocking', async () => {
    const now = new Date('2026-04-26T03:00:00-03:00');
    certs.push({
      id: 'cert-3',
      tenantId: tenantA,
      notAfter: new Date(now.getTime() - 86_400_000), // ontem
      cnpjCertificado: '11222333000181',
      ativo: true,
    });

    await svc.runOnce(now);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.tier).toBe('D-0');
    expect(alertas[0]?.severity).toBe('blocking');
    expect(alertas[0]?.diasRestantes).toBeLessThanOrEqual(0);
  });

  it('cert com ativo=false não gera alerta', async () => {
    const now = new Date('2026-04-26T03:00:00-03:00');
    certs.push({
      id: 'cert-4',
      tenantId: tenantA,
      notAfter: new Date(now.getTime() + 1 * 86_400_000),
      cnpjCertificado: '11222333000181',
      ativo: false, // <-- inativo
    });

    const r = await svc.runOnce(now);
    expect(r.processed).toBe(0);
    expect(alertas).toHaveLength(0);
    expect(prisma.alertaCertificado.upsert).not.toHaveBeenCalled();
  });

  it('cert vence em 90 dias (fora da janela) → 0 alertas', async () => {
    const now = new Date('2026-04-26T03:00:00-03:00');
    certs.push({
      id: 'cert-5',
      tenantId: tenantA,
      notAfter: new Date(now.getTime() + 90 * 86_400_000),
      cnpjCertificado: '11222333000181',
      ativo: true,
    });

    const r = await svc.runOnce(now);
    expect(r.processed).toBe(1);
    expect(r.alertsCreated).toBe(0);
    expect(alertas).toHaveLength(0);
    expect(prisma.alertaCertificado.upsert).not.toHaveBeenCalled();
  });

  it('múltiplos tenants — cada cert gera só seu alerta no tier correto', async () => {
    const now = new Date('2026-04-26T03:00:00-03:00');
    certs.push(
      {
        id: 'cert-A',
        tenantId: tenantA,
        notAfter: new Date(now.getTime() + 50 * 86_400_000), // D-60
        cnpjCertificado: '11222333000181',
        ativo: true,
      },
      {
        id: 'cert-B',
        tenantId: tenantB,
        notAfter: new Date(now.getTime() + 10 * 86_400_000), // D-15
        cnpjCertificado: '99888777000166',
        ativo: true,
      },
    );

    await svc.runOnce(now);
    expect(alertas).toHaveLength(2);
    const a = alertas.find((x) => x.tenantId === tenantA);
    const b = alertas.find((x) => x.tenantId === tenantB);
    expect(a?.tier).toBe('D-60');
    expect(a?.severity).toBe('info');
    expect(a?.certificadoId).toBe('cert-A');
    expect(b?.tier).toBe('D-15');
    expect(b?.severity).toBe('critical');
    expect(b?.certificadoId).toBe('cert-B');
  });

  it('cert que avança de tier (60d → 25d) gera alerta D-60 e D-30 distintos', async () => {
    // 1ª run: cert vence em 50d → D-60
    const day1 = new Date('2026-04-26T03:00:00-03:00');
    const notAfter = new Date(day1.getTime() + 50 * 86_400_000);
    certs.push({
      id: 'cert-progress',
      tenantId: tenantA,
      notAfter,
      cnpjCertificado: '11222333000181',
      ativo: true,
    });

    await svc.runOnce(day1);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]?.tier).toBe('D-60');

    // 2ª run, 30 dias depois — cert agora vence em 20d → D-30 (alerta NOVO)
    const day2 = new Date(day1.getTime() + 30 * 86_400_000);
    await svc.runOnce(day2);
    expect(alertas).toHaveLength(2);
    const tiers = alertas.map((a) => a.tier).sort();
    expect(tiers).toEqual(['D-30', 'D-60']);
  });

  it('runOnce sem certs ativos → 0 processed, 0 alerts, sem chamar upsert', async () => {
    const r = await svc.runOnce(new Date());
    expect(r.processed).toBe(0);
    expect(r.alertsCreated).toBe(0);
    expect(prisma.alertaCertificado.upsert).not.toHaveBeenCalled();
  });
});
