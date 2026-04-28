import { Injectable } from '@nestjs/common';
import { request } from 'node:https';
import { BusinessException } from '../../../common/business.exception';
import {
  SEFAZ_SC_ENDPOINTS,
  SEFAZ_SC_UF_CODE,
  type SefazScAmbiente,
  type SefazScServico,
} from './sefaz-sc.endpoints';

export type SefazScMtlsOptions = {
  pfx: Buffer;
  passphrase: string;
};

@Injectable()
export class SefazScSoapClient {
  getEndpoint(ambiente: SefazScAmbiente, servico: SefazScServico): string {
    return SEFAZ_SC_ENDPOINTS[ambiente][servico];
  }

  buildStatusServicoEnvelope(ambiente: SefazScAmbiente): string {
    const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';
    return this.wrapSoap12(
      'NfeStatusServico4',
      `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>${SEFAZ_SC_UF_CODE}</cUF><xServ>STATUS</xServ></consStatServ>`,
    );
  }

  async post(
    ambiente: SefazScAmbiente,
    servico: SefazScServico,
    soapAction: string,
    body: string,
    mtls: SefazScMtlsOptions,
  ): Promise<string> {
    const endpoint = new URL(this.getEndpoint(ambiente, servico));
    return new Promise((resolve, reject) => {
      const req = request(
        {
          protocol: endpoint.protocol,
          hostname: endpoint.hostname,
          path: `${endpoint.pathname}${endpoint.search}`,
          method: 'POST',
          pfx: mtls.pfx,
          passphrase: mtls.passphrase,
          timeout: 30_000,
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            SOAPAction: soapAction,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (!res.statusCode || res.statusCode >= 400) {
              reject(
                new BusinessException(
                  'SEFAZ_SC_HTTP_ERROR',
                  'SEFAZ-SC/SVRS retornou erro HTTP.',
                  502,
                  { statusCode: res.statusCode, servico },
                ),
              );
              return;
            }
            resolve(text);
          });
        },
      );
      req.on('error', (err) =>
        reject(
          new BusinessException(
            'SEFAZ_SC_NETWORK_ERROR',
            'Falha de rede ao chamar SEFAZ-SC/SVRS.',
            502,
            { message: err.message, servico },
          ),
        ),
      );
      req.on('timeout', () => {
        req.destroy();
        reject(
          new BusinessException(
            'SEFAZ_SC_TIMEOUT',
            'Timeout ao chamar SEFAZ-SC/SVRS.',
            504,
            { servico },
          ),
        );
      });
      req.write(body);
      req.end();
    });
  }

  private wrapSoap12(wsdl: string, nfeDadosMsg: string): string {
    return `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${wsdl}">${nfeDadosMsg}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  }
}
