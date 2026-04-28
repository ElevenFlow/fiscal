import type { FiscalGatewayResult } from '@nexo/shared';
import { Injectable } from '@nestjs/common';
import { BusinessException } from '../../common/business.exception';
import { SefazScSoapClient } from './sefaz-sc/sefaz-sc.soap-client';
import { SEFAZ_SC_ENDPOINTS } from './sefaz-sc/sefaz-sc.endpoints';
import type {
  FiscalGateway,
  FiscalGatewayAutorizarInput,
  FiscalGatewayCancelarInput,
  FiscalGatewayConsultarInput,
  FiscalGatewayStatusServico,
} from './fiscal.gateway';

@Injectable()
export class SefazScGateway implements FiscalGateway {
  constructor(private readonly soap: SefazScSoapClient) {}

  async statusServico(
    ambiente: 'HOMOLOGACAO' | 'PRODUCAO',
  ): Promise<FiscalGatewayStatusServico> {
    if (this.isSimulated()) {
      return {
        ok: true,
        ambiente,
        uf: 'SC',
        mensagem: 'SEFAZ-SC simulada ativa por fixtures internas. Sem chamada externa.',
      };
    }
    return {
      ok: false,
      ambiente,
      uf: 'SC',
      mensagem: `Adapter SEFAZ-SC configurado para SVRS NF-e 4.00 (${SEFAZ_SC_ENDPOINTS[ambiente].statusServico}). Smoke mTLS exige certificado A1 ativo.`,
    };
  }

  async autorizar(input: FiscalGatewayAutorizarInput): Promise<FiscalGatewayResult> {
    if (this.isSimulated()) {
      const chaveAcesso = this.extractAccessKey(input.xmlAssinado);
      const protocolo = `3422600${Date.now().toString().slice(-8)}`;
      return {
        status: 'AUTHORIZED',
        chaveAcesso,
        protocolo,
        codigo: '100',
        mensagem: 'Autorizado o uso da NF-e (simulado SEFAZ-SC).',
        xmlAutorizado: this.wrapAuthorizedXml(input.xmlAssinado, chaveAcesso, protocolo),
      };
    }
    if (!input.pfx || !input.passphrase) {
      throw this.missingCertificate('autorizar');
    }
    const envelope = this.wrapNfeDados('NFeAutorizacao4', input.xmlAssinado);
    const response = await this.soap.post(
      input.ambiente,
      'autorizacao',
      'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
      envelope,
      { pfx: input.pfx, passphrase: input.passphrase },
    );
    return this.parseSefazResponse(response);
  }

  async consultarProtocolo(input: FiscalGatewayConsultarInput): Promise<FiscalGatewayResult> {
    if (this.isSimulated()) {
      return {
        status: 'AUTHORIZED',
        chaveAcesso: input.chaveAcesso,
        protocolo: `3422600${Date.now().toString().slice(-8)}`,
        codigo: '100',
        mensagem: 'Autorizado o uso da NF-e (consulta simulada SEFAZ-SC).',
      };
    }
    return {
      status: 'PENDING_RESPONSE',
      chaveAcesso: input.chaveAcesso,
      codigo: 'CONSULTA_REQUER_CERTIFICADO',
      mensagem:
        'Consulta protocolo SEFAZ-SC/SVRS exige mTLS com certificado A1 no worker 03.3.',
    };
  }

  async cancelar(input: FiscalGatewayCancelarInput): Promise<FiscalGatewayResult> {
    if (this.isSimulated()) {
      return {
        status: 'CANCELLED',
        chaveAcesso: input.chaveAcesso,
        protocolo: `3422601${Date.now().toString().slice(-8)}`,
        codigo: '135',
        mensagem: 'Evento registrado e vinculado a NF-e (cancelamento simulado SEFAZ-SC).',
      };
    }
    return {
      status: 'CANCELLED',
      chaveAcesso: input.chaveAcesso,
      codigo: 'CANCELAMENTO_PENDENTE_SOAP',
      mensagem:
        'Cancelamento por evento sera transmitido quando o worker receber certificado A1 e XML do evento.',
    };
  }

  private missingCertificate(operation: string): BusinessException {
    return new BusinessException(
      'SEFAZ_SC_CERT_REQUIRED',
      `Operacao ${operation} exige certificado A1 em memoria para mTLS.`,
      412,
      { operation, uf: 'SC' },
    );
  }

  private wrapNfeDados(wsdl: string, xml: string): string {
    return `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${wsdl}">${xml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  }

  private parseSefazResponse(response: string): FiscalGatewayResult {
    const cStat = /<cStat>([^<]+)<\/cStat>/.exec(response)?.[1];
    const xMotivo = /<xMotivo>([^<]+)<\/xMotivo>/.exec(response)?.[1];
    const nProt = /<nProt>([^<]+)<\/nProt>/.exec(response)?.[1];
    const chNFe = /<chNFe>([^<]+)<\/chNFe>/.exec(response)?.[1];

    if (cStat === '100' || cStat === '104') {
      return {
        status: nProt ? 'AUTHORIZED' : 'PENDING_RESPONSE',
        protocolo: nProt,
        chaveAcesso: chNFe,
        codigo: cStat,
        mensagem: xMotivo,
        xmlAutorizado: response,
      };
    }
    return {
      status: 'REJECTED',
      chaveAcesso: chNFe,
      codigo: cStat,
      mensagem: xMotivo ?? 'Resposta SEFAZ sem xMotivo.',
    };
  }

  private isSimulated(): boolean {
    return (process.env.FISCAL_GATEWAY_MODE ?? 'simulated') !== 'real';
  }

  private extractAccessKey(xml: string): string {
    const id = /Id="NFe(\d{44})"/.exec(xml)?.[1] ?? /<chNFe>(\d{44})<\/chNFe>/.exec(xml)?.[1];
    return id ?? `42${Date.now().toString().padStart(42, '0').slice(0, 42)}`;
  }

  private wrapAuthorizedXml(xml: string, chaveAcesso: string, protocolo: string): string {
    const dhRecbto = new Date().toISOString();
    return `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${xml}<protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>NEXO-SIM</verAplic><chNFe>${chaveAcesso}</chNFe><dhRecbto>${dhRecbto}</dhRecbto><nProt>${protocolo}</nProt><digVal>SIMULADO</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
  }
}
