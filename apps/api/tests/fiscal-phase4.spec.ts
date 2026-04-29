import { describe, expect, it } from 'vitest';
import { DevolucaoDraftCreateSchema, NfseDraftCreateSchema } from '@nexo/shared';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('Fiscal Phase 4 contracts', () => {
  it('accepts NFS-e operational drafts for SC without municipal integration', () => {
    const parsed = NfseDraftCreateSchema.parse({
      empresaId: uuid,
      serieFiscalId: uuid,
      ambiente: 'HOMOLOGACAO',
      serie: 1,
      idempotencyKey: 'nfse-sc-test-001',
      payload: {
        municipioPrestacao: 'Florianopolis',
        ufPrestacao: 'SC',
        tomador: { nome: 'Cliente SC', cpfCnpj: '11222333000181' },
        servico: { codigoMunicipal: '1.01', descricao: 'Consultoria' },
        tributacao: { issRetido: 'nao', aliquotaIss: 5 },
        valores: { valorServico: 1000, valorLiquido: 1000 },
        integracaoMunicipal: false,
      },
    });

    expect(parsed.payload.ufPrestacao).toBe('SC');
    expect(parsed.payload.integracaoMunicipal).toBe(false);
  });

  it('rejects NFS-e drafts that try to enable municipal transmission now', () => {
    const result = NfseDraftCreateSchema.safeParse({
      empresaId: uuid,
      ambiente: 'HOMOLOGACAO',
      serie: 1,
      idempotencyKey: 'nfse-sc-test-002',
      payload: {
        municipioPrestacao: 'Florianopolis',
        ufPrestacao: 'SC',
        tomador: {},
        servico: {},
        valores: {},
        integracaoMunicipal: true,
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires devolucao references, items, CFOP and a meaningful reason', () => {
    const parsed = DevolucaoDraftCreateSchema.parse({
      empresaId: uuid,
      serieFiscalId: uuid,
      ambiente: 'HOMOLOGACAO',
      serie: 1,
      idempotencyKey: 'devolucao-test-001',
      payload: {
        chaveOrigem: '42260412345678000195550010000000011000000019',
        numeroOrigem: '123',
        fornecedor: { razaoSocial: 'Fornecedor SC' },
        itens: [
          {
            sku: 'SKU-1',
            descricao: 'Produto devolvido',
            quantidade: 2,
            valorUnitario: 50,
            cfopOrigem: '1102',
            cfopDevolucao: '5202',
          },
        ],
        motivo: 'Devolucao comercial acordada com fornecedor',
      },
    });

    expect(parsed.payload.itens[0]?.cfopDevolucao).toBe('5202');
    expect(parsed.payload.motivo.length).toBeGreaterThanOrEqual(15);
  });
});
