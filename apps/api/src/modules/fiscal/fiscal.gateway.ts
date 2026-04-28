import type { FiscalGatewayResult, NfeCancelInput } from '@nexo/shared';

export const FISCAL_GATEWAY = Symbol('FISCAL_GATEWAY');

export type FiscalGatewayStatusServico = {
  ok: boolean;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  uf: 'SC';
  mensagem: string;
};

export type FiscalGatewayAutorizarInput = {
  notaFiscalId: string;
  tenantId: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  xmlAssinado: string;
  pfx?: Buffer;
  passphrase?: string;
};

export type FiscalGatewayConsultarInput = {
  tenantId: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  chaveAcesso: string;
};

export type FiscalGatewayCancelarInput = FiscalGatewayConsultarInput & NfeCancelInput;

export interface FiscalGateway {
  statusServico(ambiente: 'HOMOLOGACAO' | 'PRODUCAO'): Promise<FiscalGatewayStatusServico>;
  autorizar(input: FiscalGatewayAutorizarInput): Promise<FiscalGatewayResult>;
  consultarProtocolo(input: FiscalGatewayConsultarInput): Promise<FiscalGatewayResult>;
  cancelar(input: FiscalGatewayCancelarInput): Promise<FiscalGatewayResult>;
}
