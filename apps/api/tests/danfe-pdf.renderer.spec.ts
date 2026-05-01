import { describe, expect, it } from 'vitest';
import { renderDanfePdfFromXml } from '../src/modules/fiscal/danfe-pdf.renderer';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  modelo: 'NFE_55',
  ambiente: 'HOMOLOGACAO',
  serie: 1,
  numero: BigInt(123),
  chaveAcesso: '42260412345678000195550010000001231000000011',
  status: 'AUTHORIZED',
  protocoloAutorizacao: '342260000000001',
  autorizadaEm: new Date('2026-04-29T12:00:00-03:00'),
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe42260412345678000195550010000001231000000011">
      <ide>
        <natOp>Venda de mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>123</nNF>
        <dhEmi>2026-04-29T09:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>Nexo Fiscal Tecnologia Ltda</xNome>
        <IE>255555555</IE>
        <enderEmit>
          <xLgr>Rua Fiscal</xLgr>
          <nro>100</nro>
          <xBairro>Centro</xBairro>
          <xMun>Florianopolis</xMun>
          <UF>SC</UF>
          <CEP>88000000</CEP>
        </enderEmit>
      </emit>
      <dest>
        <CNPJ>11222333000181</CNPJ>
        <xNome>Cliente Homologacao Ltda</xNome>
        <enderDest>
          <xLgr>Av Cliente</xLgr>
          <nro>200</nro>
          <xBairro>Trindade</xBairro>
          <xMun>Florianopolis</xMun>
          <UF>SC</UF>
          <CEP>88040000</CEP>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>SKU-001</cProd>
          <xProd>Produto fiscal de teste</xProd>
          <NCM>84715010</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>2.000</qCom>
          <vUnCom>150.00</vUnCom>
          <vProd>300.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vBC>300.00</vBC>
          <vICMS>36.00</vICMS>
          <vProd>300.00</vProd>
          <vNF>300.00</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>42260412345678000195550010000001231000000011</chNFe>
      <nProt>342260000000001</nProt>
      <dhRecbto>2026-04-29T09:00:10-03:00</dhRecbto>
    </infProt>
  </protNFe>
</nfeProc>`;

describe('renderDanfePdfFromXml', () => {
  it('renders a DANFE PDF from the authorized NF-e XML', () => {
    const pdf = renderDanfePdfFromXml(row, xml);
    const text = pdf.toString('latin1');

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('DANFE');
    expect(text).toContain('CHAVE DE ACESSO');
    expect(text).toContain('Nexo Fiscal Tecnologia Ltda');
    expect(text).toContain('Cliente Homologacao Ltda');
    expect(text).toContain('Produto fiscal de teste');
    expect(text).toContain('Valor total da NF-e');
  });
});
