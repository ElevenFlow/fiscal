import { describe, expect, it } from 'vitest';
import { SefazScSoapClient } from '../src/modules/fiscal/sefaz-sc/sefaz-sc.soap-client';
import { SefazScGateway } from '../src/modules/fiscal/sefaz-sc.gateway';

describe('SefazScGateway', () => {
  it('exposes a typed simulated SEFAZ-SC status', async () => {
    const gateway = new SefazScGateway(new SefazScSoapClient());

    await expect(gateway.statusServico('HOMOLOGACAO')).resolves.toMatchObject({
      ok: true,
      ambiente: 'HOMOLOGACAO',
      uf: 'SC',
    });
  });

  it('authorizes NF-e in simulated mode without external SEFAZ call', async () => {
    const gateway = new SefazScGateway(new SefazScSoapClient());

    await expect(
      gateway.autorizar({
        notaFiscalId: 'nota-1',
        tenantId: 'tenant-1',
        ambiente: 'HOMOLOGACAO',
        xmlAssinado: '<NFe />',
      }),
    ).resolves.toMatchObject({
      status: 'AUTHORIZED',
      codigo: '100',
    });
  });
});
