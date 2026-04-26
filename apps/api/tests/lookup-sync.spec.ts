import { BadRequestException } from '@nestjs/common';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LookupService, MIN_SIMILARITY_THRESHOLD } from '../src/modules/lookup/lookup.service';
import { LookupSyncService } from '../src/modules/lookup/lookup-sync.service';
import { CestSource } from '../src/modules/lookup/sources/cest-source';
import { CfopSource } from '../src/modules/lookup/sources/cfop-source';
import { Lc116Source } from '../src/modules/lookup/sources/lc116-source';
import { NcmSource } from '../src/modules/lookup/sources/ncm-source';

/**
 * Suite Plan 02-08 — LookupSyncService + LookupService
 *
 * Cobre:
 *  1. Sources — fixtures locais carregam ≥ minimo esperado.
 *  2. LookupSyncService.syncAll() — popula in-memory store via mock Prisma
 *     respeitando ON CONFLICT idempotência (re-run não duplica).
 *  3. LookupService.search() — autocomplete trgm: prefix-match em código,
 *     similarity em descricao, validação de tipo, hard cap de limit.
 *
 * Estratégia de mock: PrismaService falso com $executeRawUnsafe interpretando
 * o SQL gerado e mantendo Map por tabela; respeita ON CONFLICT (codigo).
 * Para LookupService.search, mock $queryRawUnsafe filtra in-memory pelo padrão
 * (substring case-insensitive) — replica suficientemente o comportamento do
 * Postgres+trgm para validar o pipeline.
 */

interface FakeRow {
  codigo: string;
  descricao: string;
  ncm_relacionado?: string | null;
  tipo?: 'entrada' | 'saida';
}

function makeFakePrisma() {
  const tables: Record<string, Map<string, FakeRow>> = {
    ncm: new Map(),
    cest: new Map(),
    cfop: new Map(),
    lc116: new Map(),
  };

  // Parse `INSERT INTO {table} (cols) VALUES (...) ON CONFLICT (codigo) DO UPDATE`
  const $executeRawUnsafe = vi.fn(async (sql: string, ...values: unknown[]) => {
    const tableMatch = /INSERT INTO\s+(\w+)\s*\(([^)]+)\)/i.exec(sql);
    if (!tableMatch) return 0;
    const table = tableMatch[1];
    const colsRaw = tableMatch[2].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    // Última coluna é "atualizado_em" (NOW()); ignora — não está em values.
    const dataCols = colsRaw.filter((c) => c !== 'atualizado_em');
    const valueCount = (sql.match(/\$\d+/g) ?? []).length;
    if (valueCount !== values.length) {
      throw new Error(`mock: parametros mismatch: sql=$${valueCount}, values=${values.length}`);
    }
    const rowSize = dataCols.length;
    if (values.length % rowSize !== 0) {
      throw new Error(`mock: values.length (${values.length}) não múltiplo de cols (${rowSize})`);
    }
    const store = tables[table];
    if (!store) throw new Error(`mock: tabela desconhecida ${table}`);

    let written = 0;
    for (let i = 0; i < values.length; i += rowSize) {
      const row: Record<string, unknown> = {};
      for (let c = 0; c < rowSize; c++) {
        row[dataCols[c]] = values[i + c];
      }
      const codigo = row.codigo as string;
      // ON CONFLICT (codigo) DO UPDATE: substitui a linha (mantém PK)
      store.set(codigo, row as FakeRow);
      written++;
    }
    return written;
  });

  // Parse `SELECT codigo, descricao... FROM {table} ... WHERE ... ORDER BY ... LIMIT $N`
  // Mock simplificado: filtra in-memory por substring case-insensitive
  // sobre codigo/descricao, ordena por (codigo prefix → 0, else 1) e codigo asc.
  const $queryRawUnsafe = vi.fn(async (sql: string, ...values: unknown[]) => {
    const tableMatch = /FROM\s+(\w+)/i.exec(sql);
    if (!tableMatch) return [];
    const table = tableMatch[1];
    const store = tables[table];
    if (!store) return [];

    // Sem WHERE → fetchTop (sem query)
    const hasWhere = /\bWHERE\b/i.test(sql);
    if (!hasWhere) {
      const limit = Number(values[values.length - 1]);
      return Array.from(store.values())
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .slice(0, limit)
        .map((r) => projectRow(r, table));
    }

    // Com WHERE: $1 = codigoPattern (`q%`), $2 = q raw, $3 = descPattern (`%q%`),
    //            $4 = threshold, $5 = limit
    const codigoPattern = String(values[0]);
    const rawQ = String(values[1]).toLowerCase();
    const limit = Number(values[4] ?? 30);
    const codigoPrefix = codigoPattern.replace(/\\([%_\\])/g, '$1').replace(/%$/, '').toLowerCase();

    const candidates = Array.from(store.values()).filter((r) => {
      const cod = r.codigo.toLowerCase();
      const desc = r.descricao.toLowerCase();
      // codigo prefix-match OR descricao contains q
      return cod.startsWith(codigoPrefix) || desc.includes(rawQ);
    });
    // Rank: prefix-match → 0, else → 1 (mantém estabilidade entre similares)
    candidates.sort((a, b) => {
      const aIsPrefix = a.codigo.toLowerCase().startsWith(codigoPrefix) ? 0 : 1;
      const bIsPrefix = b.codigo.toLowerCase().startsWith(codigoPrefix) ? 0 : 1;
      if (aIsPrefix !== bIsPrefix) return aIsPrefix - bIsPrefix;
      return a.codigo.localeCompare(b.codigo);
    });
    return candidates.slice(0, limit).map((r) => projectRow(r, table));
  });

  // Função de projeção — converte snake_case (banco) para camelCase (Prisma).
  function projectRow(r: FakeRow, table: string): Record<string, unknown> {
    const out: Record<string, unknown> = { codigo: r.codigo, descricao: r.descricao };
    if (table === 'cest') out.ncmRelacionado = r.ncm_relacionado ?? null;
    if (table === 'cfop') out.tipo = r.tipo;
    return out;
  }

  // Counts (helper para testes)
  const counts = () => ({
    ncm: tables.ncm.size,
    cest: tables.cest.size,
    cfop: tables.cfop.size,
    lc116: tables.lc116.size,
  });

  return {
    prisma: { $executeRawUnsafe, $queryRawUnsafe } as unknown,
    tables,
    counts,
  };
}

describe('Lookup sources — fixtures locais (LOOKUP_USE_FIXTURE)', () => {
  beforeEach(() => {
    process.env.LOOKUP_USE_FIXTURE = 'true';
  });

  it('NcmSource carrega ≥ 100 entradas da fixture', async () => {
    const items = await new NcmSource().fetch();
    expect(items.length).toBeGreaterThanOrEqual(100);
    expect(items[0]).toMatchObject({ codigo: expect.any(String), descricao: expect.any(String) });
    // valida que codigos são strings de 8 dígitos
    expect(items.every((i) => /^\d{8}$/.test(i.codigo))).toBe(true);
  });

  it('CestSource carrega ≥ 80 entradas da fixture', async () => {
    const items = await new CestSource().fetch();
    expect(items.length).toBeGreaterThanOrEqual(80);
  });

  it('CfopSource carrega ≥ 100 entradas da fixture com tipo entrada/saida', async () => {
    const items = await new CfopSource().fetch();
    expect(items.length).toBeGreaterThanOrEqual(100);
    expect(items.every((i) => i.tipo === 'entrada' || i.tipo === 'saida')).toBe(true);
  });

  it('Lc116Source carrega ≥ 100 entradas da fixture', async () => {
    const items = await new Lc116Source().fetch();
    expect(items.length).toBeGreaterThanOrEqual(100);
  });
});

describe('LookupSyncService.syncAll — orquestração', () => {
  let mock: ReturnType<typeof makeFakePrisma>;
  let svc: LookupSyncService;

  beforeEach(() => {
    process.env.LOOKUP_USE_FIXTURE = 'true';
    mock = makeFakePrisma();
    svc = new LookupSyncService(
      mock.prisma as never,
      new NcmSource(),
      new CestSource(),
      new CfopSource(),
      new Lc116Source(),
    );
  });

  it('popula todas as 4 tabelas a partir das fixtures', async () => {
    const r = await svc.syncAll();
    expect(r.ncm).toBeGreaterThanOrEqual(100);
    expect(r.cest).toBeGreaterThanOrEqual(80);
    expect(r.cfop).toBeGreaterThanOrEqual(100);
    expect(r.lc116).toBeGreaterThanOrEqual(100);
    expect(r.failures).toEqual([]);
    const counts = mock.counts();
    expect(counts.ncm).toBeGreaterThanOrEqual(100);
    expect(counts.cest).toBeGreaterThanOrEqual(80);
    expect(counts.cfop).toBeGreaterThanOrEqual(100);
    expect(counts.lc116).toBeGreaterThanOrEqual(100);
  });

  it('idempotência via ON CONFLICT — re-run não duplica linhas', async () => {
    await svc.syncAll();
    const before = mock.counts();
    await svc.syncAll();
    const after = mock.counts();
    expect(after).toEqual(before);
  });

  it('falha em uma source não bloqueia as outras', async () => {
    // Mock NcmSource para falhar
    const ncmFail = {
      fetch: vi.fn(async () => {
        throw new Error('fake network down');
      }),
    } as unknown as NcmSource;
    const failSvc = new LookupSyncService(
      mock.prisma as never,
      ncmFail,
      new CestSource(),
      new CfopSource(),
      new Lc116Source(),
    );
    const r = await failSvc.syncAll();
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toMatch(/NCM sync failed/);
    // Outras sources rodaram
    expect(r.cest).toBeGreaterThanOrEqual(80);
    expect(r.cfop).toBeGreaterThanOrEqual(100);
    expect(r.lc116).toBeGreaterThanOrEqual(100);
    expect(r.ncm).toBe(0);
  });
});

describe('LookupService.search — autocomplete trgm', () => {
  let mock: ReturnType<typeof makeFakePrisma>;
  let svc: LookupService;
  let syncSvc: LookupSyncService;

  beforeEach(async () => {
    process.env.LOOKUP_USE_FIXTURE = 'true';
    mock = makeFakePrisma();
    svc = new LookupService(mock.prisma as never);
    syncSvc = new LookupSyncService(
      mock.prisma as never,
      new NcmSource(),
      new CestSource(),
      new CfopSource(),
      new Lc116Source(),
    );
    // Popula fixtures via syncAll para que search tenha dados
    await syncSvc.syncAll();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('retorna até 30 NCMs sem query (top by codigo asc)', async () => {
    const results = await svc.search('ncm', undefined);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(30);
    // Ordenado por codigo asc
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].codigo.localeCompare(results[i].codigo)).toBeLessThanOrEqual(0);
    }
  });

  it('busca NCM por código (prefix match) — 0401', async () => {
    const results = await svc.search('ncm', '0401');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.codigo.startsWith('0401'))).toBe(true);
  });

  it('busca CFOP por descrição via trgm — "venda"', async () => {
    const results = await svc.search('cfop', 'venda');
    expect(results.length).toBeGreaterThan(0);
    // Pelo menos um resultado contém "venda" na descrição
    const hasVenda = results.some((r) => r.descricao.toLowerCase().includes('venda'));
    expect(hasVenda).toBe(true);
  });

  it('busca LC116 por descrição via trgm — "consultoria"', async () => {
    const results = await svc.search('lc116', 'consultoria');
    expect(results.length).toBeGreaterThan(0);
  });

  it('tipo inválido lança BadRequestException com code INVALID_LOOKUP_TYPE', async () => {
    await expect(svc.search('foo', 'x')).rejects.toBeInstanceOf(BadRequestException);
    try {
      await svc.search('foo', 'x');
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { code?: string };
      expect(body.code).toBe('INVALID_LOOKUP_TYPE');
    }
  });

  it('limit > 100 é truncado para 100 (hard cap)', async () => {
    const results = await svc.search('ncm', undefined, 9999);
    expect(results.length).toBeLessThanOrEqual(100);
  });

  it('limit < 1 é coerced para 1', async () => {
    const results = await svc.search('ncm', undefined, 0);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('CEST retorna ncmRelacionado quando presente', async () => {
    const results = await svc.search('cest', undefined, 5);
    expect(results.length).toBeGreaterThan(0);
    // Pelo menos 1 entrada com ncmRelacionado preenchido
    const withNcm = results.filter((r) => r.ncmRelacionado);
    expect(withNcm.length).toBeGreaterThan(0);
  });

  it('CFOP retorna campo tipo (entrada|saida)', async () => {
    const results = await svc.search('cfop', undefined, 10);
    expect(results.every((r) => r.tipo === 'entrada' || r.tipo === 'saida')).toBe(true);
  });
});

describe('LookupService — constantes', () => {
  it('exporta MIN_SIMILARITY_THRESHOLD = 0.2', () => {
    expect(MIN_SIMILARITY_THRESHOLD).toBe(0.2);
  });
});
