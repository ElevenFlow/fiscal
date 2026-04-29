import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { BusinessException } from '../../common/business.exception';

const MAX_XML_BYTES = 10 * 1024 * 1024;
const FORBIDDEN_XML_TOKENS = ['<!DOCTYPE', '<!ENTITY', 'SYSTEM', 'PUBLIC'];

export interface ParsedXmlCompraItem {
  id: string;
  codigoFornecedor: string;
  descricao: string;
  ncm: string;
  cfop: string | null;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
}

export interface ParsedXmlCompra {
  chaveAcesso: string;
  fornecedorNome: string;
  fornecedorCnpj: string | null;
  emitidaEm: Date | null;
  valorTotal: string;
  itens: ParsedXmlCompraItem[];
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

@Injectable()
export class XmlCompraParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    trimValues: true,
  });

  parse(xml: string): ParsedXmlCompra {
    const bytes = Buffer.byteLength(xml, 'utf8');
    if (bytes > MAX_XML_BYTES) {
      throw new BusinessException('XML_TOO_LARGE', 'XML excede o limite de 10MB', 413);
    }

    const upper = xml.toUpperCase();
    const blocked = FORBIDDEN_XML_TOKENS.find((token) => upper.includes(token));
    if (blocked) {
      throw new BusinessException('XML_UNSAFE', `XML contem token bloqueado: ${blocked}`, 400);
    }

    let parsed: unknown;
    try {
      parsed = this.parser.parse(xml);
    } catch {
      throw new BusinessException('XML_INVALIDO', 'XML de NF-e invalido ou mal formado', 400);
    }

    const root = parsed as Record<string, unknown>;
    const nfeProc = root.nfeProc as Record<string, unknown> | undefined;
    const nfe = (nfeProc?.NFe ?? root.NFe) as Record<string, unknown> | undefined;
    const infNFe = nfe?.infNFe as Record<string, unknown> | undefined;
    if (!infNFe) {
      throw new BusinessException('XML_INVALIDO', 'XML nao contem NFe.infNFe', 400);
    }

    const ide = infNFe.ide as Record<string, unknown> | undefined;
    const emit = infNFe.emit as Record<string, unknown> | undefined;
    const total = infNFe.total as Record<string, unknown> | undefined;
    const icmsTot = total?.ICMSTot as Record<string, unknown> | undefined;
    const protNFe = nfeProc?.protNFe as Record<string, unknown> | undefined;
    const infProt = protNFe?.infProt as Record<string, unknown> | undefined;

    const chaveAcesso =
      text(infNFe['@_Id']).replace(/^NFe/, '') || text(infProt?.chNFe).replace(/^NFe/, '');
    if (!/^\d{44}$/.test(chaveAcesso)) {
      throw new BusinessException('XML_CHAVE_INVALIDA', 'Chave de acesso da NF-e invalida', 400);
    }

    const dets = asArray(infNFe.det as Record<string, unknown> | Record<string, unknown>[]);
    const itens = dets.map((det, index) => {
      const prod = det.prod as Record<string, unknown> | undefined;
      return {
        id: text(det['@_nItem']) || String(index + 1),
        codigoFornecedor: text(prod?.cProd) || `ITEM-${index + 1}`,
        descricao: text(prod?.xProd),
        ncm: text(prod?.NCM).replace(/\D/g, ''),
        cfop: text(prod?.CFOP) || null,
        unidade: text(prod?.uCom) || 'UN',
        quantidade: text(prod?.qCom) || '0',
        valorUnitario: text(prod?.vUnCom) || '0',
        valorTotal: text(prod?.vProd) || '0',
      };
    });

    if (itens.length === 0 || itens.some((item) => !item.descricao || !item.ncm)) {
      throw new BusinessException('XML_SEM_ITENS', 'XML sem itens de produto validos', 400);
    }

    const dhEmi = text(ide?.dhEmi) || text(ide?.dEmi);
    return {
      chaveAcesso,
      fornecedorNome: text(emit?.xNome) || 'Fornecedor nao identificado',
      fornecedorCnpj: text(emit?.CNPJ).replace(/\D/g, '') || null,
      emitidaEm: dhEmi ? new Date(dhEmi) : null,
      valorTotal:
        text(icmsTot?.vNF) ||
        itens.reduce((acc, item) => acc + Number(item.valorTotal), 0).toFixed(2),
      itens,
    };
  }
}
