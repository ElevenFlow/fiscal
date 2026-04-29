import { describe, expect, it } from 'vitest';
import { BusinessException } from '../src/common/business.exception';
import { XmlCompraParserService } from '../src/modules/estoque/xml-compra-parser.service';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe42260412345678000195550010000000011000000010">
      <ide>
        <dhEmi>2026-04-28T10:30:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>Fornecedor Teste LTDA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>CAB-01</cProd>
          <xProd>CABO FLEXIVEL 2,5MM</xProd>
          <NCM>85444900</NCM>
          <CFOP>5102</CFOP>
          <uCom>RL</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>189.9000</vUnCom>
          <vProd>1899.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>1899.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>42260412345678000195550010000000011000000010</chNFe>
    </infProt>
  </protNFe>
</nfeProc>`;

describe('XmlCompraParserService', () => {
  it('parses NF-e purchase XML fields used by estoque importacao', () => {
    const parser = new XmlCompraParserService();

    const parsed = parser.parse(SAMPLE_XML);

    expect(parsed.chaveAcesso).toBe('42260412345678000195550010000000011000000010');
    expect(parsed.fornecedorNome).toBe('Fornecedor Teste LTDA');
    expect(parsed.fornecedorCnpj).toBe('12345678000195');
    expect(parsed.valorTotal).toBe('1899');
    expect(parsed.itens).toEqual([
      expect.objectContaining({
        id: '1',
        codigoFornecedor: 'CAB-01',
        descricao: 'CABO FLEXIVEL 2,5MM',
        ncm: '85444900',
        unidade: 'RL',
        quantidade: '10',
      }),
    ]);
  });

  it('rejects XML with DTD/entity expansion tokens before parsing', () => {
    const parser = new XmlCompraParserService();
    const unsafeXml = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><NFe />`;

    expect(() => parser.parse(unsafeXml)).toThrow(BusinessException);
    expect(() => parser.parse(unsafeXml)).toThrow(/DOCTYPE/);
  });
});
