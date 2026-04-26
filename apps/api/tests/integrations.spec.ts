import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BusinessException,
  NotFoundResourceException,
} from '../src/common/business.exception';
import { BrasilApiService } from '../src/modules/integrations/brasilapi.service';
import { ViaCepService } from '../src/modules/integrations/viacep.service';

/**
 * Suite Plan 02-03 Task 3 — IntegrationsModule (BrasilAPI + ViaCEP).
 *
 * Estratégia: mocka `globalThis.fetch` + `PrismaService` (cnpjCache/cepCache).
 * Cobre:
 *  - Cache hit (não chama fetch)
 *  - Cache miss + 200 sucesso (chama fetch + persiste cache)
 *  - Upstream 404 → NotFoundResourceException
 *  - Upstream 429 → BusinessException UPSTREAM_RATE_LIMIT
 *  - Upstream timeout/abort → BusinessException UPSTREAM_TIMEOUT (503)
 *  - Input inválido (não 14 dígitos / não 8 dígitos) → BusinessException 400 sem chamar fetch
 *  - ViaCEP { erro: true } → NotFoundResourceException (peculiaridade do upstream)
 *  - ViaCEP localidade ausente → NotFoundResourceException
 *  - SSRF guard: a URL construída literal `https://brasilapi.com.br/...` é a única possível;
 *    cnpj/cep só permitem dígitos depois de sanitização → não é manipulável.
 *  - Cache poisoning defense: campos extras do upstream NÃO entram no DB (apenas o
 *    NormalizedCnpjPayload com campos curados).
 */

interface CacheRow {
  cnpj?: string;
  cep?: string;
  payload: object;
  fetchedAt: Date;
  expiresAt: Date;
}

function makeFakePrismaCnpj(initialRows: CacheRow[] = []) {
  const rows = [...initialRows];
  const cnpjCache = {
    findUnique: vi.fn(async (args: { where: { cnpj: string } }) => {
      return rows.find((r) => r.cnpj === args.where.cnpj) ?? null;
    }),
    upsert: vi.fn(
      async (args: {
        where: { cnpj: string };
        create: CacheRow;
        update: Partial<CacheRow>;
      }) => {
        const idx = rows.findIndex((r) => r.cnpj === args.where.cnpj);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...args.update } as CacheRow;
          return rows[idx];
        }
        const row: CacheRow = {
          ...args.create,
          fetchedAt: args.create.fetchedAt ?? new Date(),
        };
        rows.push(row);
        return row;
      },
    ),
  };
  return { rows, cnpjCache };
}

function makeFakePrismaCep(initialRows: CacheRow[] = []) {
  const rows = [...initialRows];
  const cepCache = {
    findUnique: vi.fn(async (args: { where: { cep: string } }) => {
      return rows.find((r) => r.cep === args.where.cep) ?? null;
    }),
    upsert: vi.fn(
      async (args: {
        where: { cep: string };
        create: CacheRow;
        update: Partial<CacheRow>;
      }) => {
        const idx = rows.findIndex((r) => r.cep === args.where.cep);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...args.update } as CacheRow;
          return rows[idx];
        }
        const row: CacheRow = {
          ...args.create,
          fetchedAt: args.create.fetchedAt ?? new Date(),
        };
        rows.push(row);
        return row;
      },
    ),
  };
  return { rows, cepCache };
}

// ============================================================================
describe('integrations — BrasilApiService', () => {
  let svc: BrasilApiService;
  let fake: ReturnType<typeof makeFakePrismaCnpj>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fake = makeFakePrismaCnpj([]);
    svc = new BrasilApiService(fake as unknown as never);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('cache miss + 200 → busca BrasilAPI, normaliza e persiste no cache', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cnpj: '11222333000181',
          razao_social: 'TESTE LTDA',
          nome_fantasia: 'TESTE',
          situacao_cadastral: 2,
          descricao_situacao_cadastral: 'ATIVA',
          cnae_fiscal: 4751201,
          cnae_fiscal_descricao: 'Comércio varejista de informática',
          cep: '01310-100',
          logradouro: 'Av Paulista',
          municipio: 'São Paulo',
          uf: 'SP',
          opcao_pelo_simples: true,
        }),
        { status: 200 },
      ),
    );

    const result = await svc.fetchCnpj('11222333000181');

    expect(result.razaoSocial).toBe('TESTE LTDA');
    expect(result.nomeFantasia).toBe('TESTE');
    expect(result.situacao).toBe('ATIVA');
    expect(result.cnae).toBe('4751201');
    expect(result.endereco.cep).toBe('01310100');
    expect(result.endereco.cidade).toBe('São Paulo');
    expect(result.endereco.uf).toBe('SP');
    expect(result.optanteSimples).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fake.cnpjCache.upsert).toHaveBeenCalledOnce();

    // Persiste somente campos normalizados (defesa cache poisoning).
    const upsertCall = fake.cnpjCache.upsert.mock.calls[0]?.[0] as
      | { create: { payload: Record<string, unknown> } }
      | undefined;
    expect(upsertCall?.create.payload).toMatchObject({
      cnpj: '11222333000181',
      razaoSocial: 'TESTE LTDA',
    });
    // Campos crus do upstream NÃO devem aparecer no payload persistido
    expect(upsertCall?.create.payload).not.toHaveProperty('razao_social');
  });

  it('cache hit → retorna do DB sem chamar fetch', async () => {
    const future = new Date(Date.now() + 86_400_000);
    fake = makeFakePrismaCnpj([
      {
        cnpj: '11222333000181',
        payload: { cnpj: '11222333000181', razaoSocial: 'CACHED CO' },
        fetchedAt: new Date(),
        expiresAt: future,
      },
    ]);
    svc = new BrasilApiService(fake as unknown as never);

    const result = await svc.fetchCnpj('11222333000181');
    expect((result as { razaoSocial: string }).razaoSocial).toBe('CACHED CO');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cache expirado → faz nova request', async () => {
    const past = new Date(Date.now() - 86_400_000);
    fake = makeFakePrismaCnpj([
      {
        cnpj: '11222333000181',
        payload: { cnpj: '11222333000181', razaoSocial: 'STALE' },
        fetchedAt: past,
        expiresAt: past,
      },
    ]);
    svc = new BrasilApiService(fake as unknown as never);

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cnpj: '11222333000181',
          razao_social: 'FRESH LTDA',
          situacao_cadastral: 2,
          cnae_fiscal: 1234567,
        }),
        { status: 200 },
      ),
    );

    const result = await svc.fetchCnpj('11222333000181');
    expect(result.razaoSocial).toBe('FRESH LTDA');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('upstream 404 → NotFoundResourceException', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('Not found', { status: 404 }));
    await expect(svc.fetchCnpj('99999999999999')).rejects.toBeInstanceOf(
      NotFoundResourceException,
    );
  });

  it('upstream 429 → BusinessException UPSTREAM_RATE_LIMIT', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));
    await expect(svc.fetchCnpj('11222333000181')).rejects.toMatchObject({
      code: 'UPSTREAM_RATE_LIMIT',
      httpStatus: 429,
    });
  });

  it('upstream 5xx genérico → BusinessException UPSTREAM_ERROR', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 502 }));
    await expect(svc.fetchCnpj('11222333000181')).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      httpStatus: 503,
    });
  });

  it('CNPJ inválido (3 dígitos) → BusinessException sem chamar fetch', async () => {
    await expect(svc.fetchCnpj('123')).rejects.toMatchObject({
      code: 'INVALID_CNPJ',
      httpStatus: 400,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('CNPJ com máscara é sanitizado e funciona', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ cnpj: '11222333000181', razao_social: 'X', cnae_fiscal: 1 }),
        { status: 200 },
      ),
    );
    const result = await svc.fetchCnpj('11.222.333/0001-81');
    expect(result.cnpj).toBe('11222333000181');
    // Confirma que a URL chamada tem só dígitos (sem máscara) e o host correto
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe('https://brasilapi.com.br/api/cnpj/v1/11222333000181');
  });

  it('upstream timeout (AbortError) → BusinessException UPSTREAM_TIMEOUT 503', async () => {
    fetchSpy.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    await expect(svc.fetchCnpj('11222333000181')).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      httpStatus: 503,
    });
  });

  it('JSON inválido do upstream → BusinessException UPSTREAM_ERROR', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    await expect(svc.fetchCnpj('11222333000181')).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
    });
  });
});

// ============================================================================
describe('integrations — ViaCepService', () => {
  let svc: ViaCepService;
  let fake: ReturnType<typeof makeFakePrismaCep>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fake = makeFakePrismaCep([]);
    svc = new ViaCepService(fake as unknown as never);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('200 com payload válido → normaliza e persiste cache', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          localidade: 'São Paulo',
          uf: 'SP',
          ibge: '3550308',
        }),
        { status: 200 },
      ),
    );
    const r = await svc.fetchCep('01310100');
    expect(r.cidade).toBe('São Paulo');
    expect(r.uf).toBe('SP');
    expect(r.logradouro).toBe('Avenida Paulista');
    expect(r.bairro).toBe('Bela Vista');
    expect(r.ibge).toBe('3550308');
    expect(fake.cepCache.upsert).toHaveBeenCalledOnce();
  });

  it('200 com { erro: true } → NotFoundResourceException', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ erro: true }), { status: 200 }),
    );
    await expect(svc.fetchCep('00000000')).rejects.toBeInstanceOf(NotFoundResourceException);
  });

  it('200 sem localidade → NotFoundResourceException', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ cep: '01310100' }), { status: 200 }),
    );
    await expect(svc.fetchCep('01310100')).rejects.toBeInstanceOf(NotFoundResourceException);
  });

  it('cache hit → retorna do DB', async () => {
    const future = new Date(Date.now() + 86_400_000);
    fake = makeFakePrismaCep([
      {
        cep: '01310100',
        payload: { cep: '01310100', cidade: 'CACHED', uf: 'SP', logradouro: null, bairro: null, complemento: null, ibge: null },
        fetchedAt: new Date(),
        expiresAt: future,
      },
    ]);
    svc = new ViaCepService(fake as unknown as never);
    const r = await svc.fetchCep('01310100');
    expect(r.cidade).toBe('CACHED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('CEP inválido (5 dígitos) → BusinessException sem chamar fetch', async () => {
    await expect(svc.fetchCep('12345')).rejects.toMatchObject({
      code: 'INVALID_CEP',
      httpStatus: 400,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('upstream timeout → BusinessException UPSTREAM_TIMEOUT', async () => {
    fetchSpy.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    await expect(svc.fetchCep('01310100')).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      httpStatus: 503,
    });
  });

  it('CEP com máscara é sanitizado e URL correta', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cep: '01310-100',
          localidade: 'São Paulo',
          uf: 'SP',
        }),
        { status: 200 },
      ),
    );
    await svc.fetchCep('01310-100');
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe('https://viacep.com.br/ws/01310100/json/');
  });

  it('SSRF defense: URL é sempre prefixada por viacep.com.br', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ cep: '01310100', localidade: 'X', uf: 'SP' }),
        { status: 200 },
      ),
    );
    await svc.fetchCep('01310100');
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl.startsWith('https://viacep.com.br/')).toBe(true);
  });

  it('rejeita BusinessException quando fetch retorna 502', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 502 }));
    await expect(svc.fetchCep('01310100')).rejects.toBeInstanceOf(BusinessException);
  });
});
