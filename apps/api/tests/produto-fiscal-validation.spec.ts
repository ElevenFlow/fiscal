import { describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../src/common/business.exception';
import { ProdutoFiscalValidationService } from '../src/modules/produtos/produto-fiscal-validation.service';

function makeService(rows: Array<{ codigo: string }> = [{ codigo: '22089000' }]) {
  const prisma = {
    $queryRawUnsafe: vi.fn().mockResolvedValue(rows),
  };
  return {
    prisma,
    service: new ProdutoFiscalValidationService(prisma as never),
  };
}

describe('ProdutoFiscalValidationService', () => {
  it('aceita NCM vigente sem CEST', async () => {
    const { prisma, service } = makeService([{ codigo: '85444900' }]);

    await expect(service.validate({ ncm: '85444900', cest: null })).resolves.toBeUndefined();

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.any(String), '85444900');
  });

  it('rejeita NCM inexistente ou nao vigente', async () => {
    const { service } = makeService([]);

    await expect(service.validate({ ncm: '00000000' })).rejects.toMatchObject({
      code: 'INVALID_NCM',
      httpStatus: 422,
    });
  });

  it('aceita CEST quando o NCM bate com NCM completo em Santa Catarina', async () => {
    const { service } = makeService([{ codigo: '22089000' }]);

    await expect(service.validate({ ncm: '22089000', cest: '02.001.00' })).resolves.toBeUndefined();
  });

  it('aceita CEST quando a fonte de SC informa prefixo NCM/SH', async () => {
    const { service } = makeService([{ codigo: '22050010' }]);

    await expect(service.validate({ ncm: '22050010', cest: '0200100' })).resolves.toBeUndefined();
  });

  it('rejeita CEST inexistente no Anexo 1-A de SC', async () => {
    const { service } = makeService([{ codigo: '22089000' }]);

    await expect(service.validate({ ncm: '22089000', cest: '9999999' })).rejects.toMatchObject({
      code: 'INVALID_CEST_SC',
      httpStatus: 422,
    });
  });

  it('rejeita CEST incompatível com o NCM para Santa Catarina', async () => {
    const { service } = makeService([{ codigo: '85444900' }]);

    await expect(service.validate({ ncm: '85444900', cest: '0200100' })).rejects.toBeInstanceOf(
      BusinessException,
    );
    await expect(service.validate({ ncm: '85444900', cest: '0200100' })).rejects.toMatchObject({
      code: 'INVALID_CEST_NCM_SC',
      httpStatus: 422,
    });
  });
});
