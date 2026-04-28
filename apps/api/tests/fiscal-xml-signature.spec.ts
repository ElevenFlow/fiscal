import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SefazScSoapClient } from '../src/modules/fiscal/sefaz-sc/sefaz-sc.soap-client';
import { PfxKeyMaterialService } from '../src/modules/fiscal/signing/pfx-key-material.service';
import { XmlSignerService } from '../src/modules/fiscal/signing/xml-signer.service';
import { NfeXmlBuilderService } from '../src/modules/fiscal/xml/nfe-xml.builder';

const FIXTURE_PATH = join(__dirname, 'fixtures', 'test-cert.pfx');
const PASSWORD = 'test1234';
const ACCESS_KEY = '42160412345678000195550010000000011000000019';

describe('NF-e XML/signature foundation', () => {
  it('builds deterministic NF-e 4.00 XML with SC access key', () => {
    const builder = new NfeXmlBuilderService();
    const xml = builder.build({
      infNFeId: `NFe${ACCESS_KEY}`,
      infNFe: {
        ide: {
          cUF: '42',
          cNF: '00000001',
          natOp: 'VENDA',
          mod: '55',
          serie: '1',
          nNF: '1',
        },
        emit: { CNPJ: '12345678000195', xNome: 'NEXO TESTE LTDA' },
      },
    });

    expect(xml).toContain('xmlns="http://www.portalfiscal.inf.br/nfe"');
    expect(xml).toContain(`Id="NFe${ACCESS_KEY}"`);
    expect(xml).toContain('versao="4.00"');
  });

  it('extracts PFX key material and signs infNFe with XMLDSig/C14N', () => {
    const pfx = readFileSync(FIXTURE_PATH);
    const material = new PfxKeyMaterialService().extract(pfx, PASSWORD);
    const xml = new NfeXmlBuilderService().build({
      infNFeId: `NFe${ACCESS_KEY}`,
      infNFe: {
        ide: { cUF: '42', mod: '55', serie: '1', nNF: '1' },
        emit: { CNPJ: '12345678000195', xNome: 'NEXO TESTE LTDA' },
      },
    });

    const signed = new XmlSignerService().signNfe(xml, `NFe${ACCESS_KEY}`, material);

    expect(signed).toContain('<Signature');
    expect(signed).toContain('http://www.w3.org/TR/2001/REC-xml-c14n-20010315');
    expect(signed).toContain('http://www.w3.org/2000/09/xmldsig#rsa-sha1');
    expect(signed).toContain('<X509Certificate>');
  });
});

describe('SefazScSoapClient', () => {
  it('maps Santa Catarina NF-e 4.00 to SVRS endpoints', () => {
    const client = new SefazScSoapClient();

    expect(client.getEndpoint('HOMOLOGACAO', 'statusServico')).toBe(
      'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    );
    expect(client.getEndpoint('PRODUCAO', 'autorizacao')).toBe(
      'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    );
  });

  it('builds status service SOAP 1.2 envelope for SC', () => {
    const envelope = new SefazScSoapClient().buildStatusServicoEnvelope('HOMOLOGACAO');

    expect(envelope).toContain('soap12:Envelope');
    expect(envelope).toContain('<tpAmb>2</tpAmb>');
    expect(envelope).toContain('<cUF>42</cUF>');
    expect(envelope).toContain('<xServ>STATUS</xServ>');
  });
});
