import { XMLParser } from 'fast-xml-parser';

type DanfeNota = {
  id: string;
  modelo: string;
  ambiente: string;
  serie: number;
  numero: bigint | number | null;
  chaveAcesso: string | null;
  status: string;
  protocoloAutorizacao: string | null;
  autorizadaEm: Date | null;
};

type PdfLine = {
  x: number;
  y: number;
  text: string;
  size?: number;
  font?: 'F1' | 'F2';
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

export function renderDanfePdfFromXml(row: DanfeNota, xml: string): Buffer {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const proc = objectAt(parsed, ['nfeProc']) ?? parsed;
  const nfe = objectAt(proc, ['NFe']) ?? objectAt(parsed, ['NFe']) ?? {};
  const infNFe = objectAt(nfe, ['infNFe']) ?? {};
  const ide = objectAt(infNFe, ['ide']) ?? {};
  const emit = objectAt(infNFe, ['emit']) ?? {};
  const dest = objectAt(infNFe, ['dest']) ?? {};
  const total = objectAt(infNFe, ['total', 'ICMSTot']) ?? {};
  const transp = objectAt(infNFe, ['transp']) ?? {};
  const prot = objectAt(proc, ['protNFe', 'infProt']) ?? {};
  const itens = asArray(valueAt(infNFe, ['det']));
  const chave = row.chaveAcesso ?? text(prot, 'chNFe') ?? idToChave(text(infNFe, '@_Id'));
  const protocolo = row.protocoloAutorizacao ?? text(prot, 'nProt') ?? '-';

  const pages: PdfLine[][] = [[]];
  const add = (line: PdfLine) => current(pages).push(line);
  const addText = (x: number, y: number, textValue: string, size = 8, font: 'F1' | 'F2' = 'F1') =>
    add({ x, y, text: textValue, size, font });

  header(addText, row, chave, protocolo, ide, emit, dest);
  section(addText, 712, 'IDENTIFICACAO DA NF-E', [
    `Natureza: ${text(ide, 'natOp') ?? '-'}`,
    `Modelo: ${text(ide, 'mod') ?? row.modelo}   Serie: ${text(ide, 'serie') ?? row.serie}   Numero: ${text(ide, 'nNF') ?? row.numero?.toString() ?? '-'}`,
    `Emissao: ${formatDate(text(ide, 'dhEmi') ?? text(ide, 'dEmi'))}   Saida/Entrada: ${formatDate(text(ide, 'dhSaiEnt') ?? text(ide, 'dSaiEnt'))}`,
  ]);
  party(addText, 650, 'EMITENTE', emit, 'enderEmit');
  party(addText, 580, 'DESTINATARIO / REMETENTE', dest, 'enderDest');
  section(addText, 505, 'CALCULO DO IMPOSTO', [
    `Base ICMS: ${money(text(total, 'vBC'))}   Valor ICMS: ${money(text(total, 'vICMS'))}   ICMS ST: ${money(text(total, 'vST'))}`,
    `Produtos: ${money(text(total, 'vProd'))}   Frete: ${money(text(total, 'vFrete'))}   Desconto: ${money(text(total, 'vDesc'))}   Outros: ${money(text(total, 'vOutro'))}`,
    `Valor total da NF-e: ${money(text(total, 'vNF'))}`,
  ]);
  section(addText, 430, 'TRANSPORTADOR / VOLUMES', [
    `Modalidade do frete: ${frete(text(transp, 'modFrete'))}`,
    `Volumes: ${text(objectAt(transp, ['vol']) ?? {}, 'qVol') ?? '-'}   Especie: ${text(objectAt(transp, ['vol']) ?? {}, 'esp') ?? '-'}   Peso bruto: ${text(objectAt(transp, ['vol']) ?? {}, 'pesoB') ?? '-'}`,
  ]);

  addText(40, 372, 'DADOS DOS PRODUTOS / SERVICOS', 9, 'F2');
  addText(40, 354, 'CODIGO', 7, 'F2');
  addText(105, 354, 'DESCRICAO', 7, 'F2');
  addText(310, 354, 'NCM', 7, 'F2');
  addText(354, 354, 'CFOP', 7, 'F2');
  addText(390, 354, 'UN', 7, 'F2');
  addText(420, 354, 'QTD', 7, 'F2');
  addText(470, 354, 'V.UNIT', 7, 'F2');
  addText(525, 354, 'V.TOTAL', 7, 'F2');

  let y = 338;
  for (const item of itens) {
    const prod = objectAt(item, ['prod']) ?? {};
    if (y < 70) {
      pages.push([]);
      y = 790;
      addText(40, 812, `DANFE - continuacao - chave ${groupChave(chave)}`, 9, 'F2');
      addText(40, y, 'CODIGO', 7, 'F2');
      addText(105, y, 'DESCRICAO', 7, 'F2');
      addText(310, y, 'NCM', 7, 'F2');
      addText(354, y, 'CFOP', 7, 'F2');
      addText(390, y, 'UN', 7, 'F2');
      addText(420, y, 'QTD', 7, 'F2');
      addText(470, y, 'V.UNIT', 7, 'F2');
      addText(525, y, 'V.TOTAL', 7, 'F2');
      y -= 16;
    }
    addText(40, y, fit(text(prod, 'cProd') ?? '-', 12), 7);
    addText(105, y, fit(text(prod, 'xProd') ?? '-', 38), 7);
    addText(310, y, text(prod, 'NCM') ?? '-', 7);
    addText(354, y, text(prod, 'CFOP') ?? '-', 7);
    addText(390, y, text(prod, 'uCom') ?? '-', 7);
    addText(420, y, qty(text(prod, 'qCom')), 7);
    addText(470, y, money(text(prod, 'vUnCom')), 7);
    addText(525, y, money(text(prod, 'vProd')), 7);
    y -= 14;
  }

  const footerY = Math.max(44, y - 20);
  addText(40, footerY, 'Dados adicionais', 8, 'F2');
  addText(
    40,
    footerY - 14,
    fit(
      `Protocolo: ${protocolo}   Autorizacao: ${formatDate(text(prot, 'dhRecbto') ?? row.autorizadaEm?.toISOString())}   Status: ${row.status}`,
      105,
    ),
    7,
  );
  addText(
    40,
    footerY - 28,
    'XML autorizado e o documento fiscal eletronico original sao a fonte de verdade fiscal.',
    7,
  );

  return buildPdf(pages);
}

function header(
  addText: (x: number, y: number, textValue: string, size?: number, font?: 'F1' | 'F2') => void,
  row: DanfeNota,
  chave: string | null,
  protocolo: string,
  ide: Record<string, unknown>,
  emit: Record<string, unknown>,
  dest: Record<string, unknown>,
) {
  addText(40, 808, 'DANFE', 18, 'F2');
  addText(126, 812, 'Documento Auxiliar da Nota Fiscal Eletronica', 9, 'F2');
  addText(126, 798, 'Consulta pela chave de acesso no portal nacional da NF-e', 7);
  addText(380, 812, `NF-e No. ${text(ide, 'nNF') ?? row.numero?.toString() ?? '-'}`, 10, 'F2');
  addText(380, 798, `Serie ${text(ide, 'serie') ?? row.serie}   ${row.ambiente}`, 8, 'F2');
  addText(40, 774, `CHAVE DE ACESSO: ${groupChave(chave)}`, 10, 'F2');
  addText(40, 758, `PROTOCOLO DE AUTORIZACAO: ${protocolo}`, 8);
  addText(
    40,
    742,
    `EMITENTE: ${fit(text(emit, 'xNome') ?? '-', 72)}   CNPJ: ${formatDoc(text(emit, 'CNPJ'))}`,
    8,
  );
  addText(
    40,
    728,
    `DESTINATARIO: ${fit(text(dest, 'xNome') ?? '-', 66)}   DOC: ${formatDoc(text(dest, 'CNPJ') ?? text(dest, 'CPF'))}`,
    8,
  );
}

function section(
  addText: (x: number, y: number, textValue: string, size?: number, font?: 'F1' | 'F2') => void,
  y: number,
  title: string,
  lines: string[],
) {
  addText(40, y, title, 9, 'F2');
  lines.forEach((line, index) => addText(40, y - 16 - index * 13, fit(line, 108), 8));
}

function party(
  addText: (x: number, y: number, textValue: string, size?: number, font?: 'F1' | 'F2') => void,
  y: number,
  title: string,
  partyData: Record<string, unknown>,
  addressKey: string,
) {
  const address = objectAt(partyData, [addressKey]) ?? {};
  section(addText, y, title, [
    `${text(partyData, 'xNome') ?? '-'}   Documento: ${formatDoc(text(partyData, 'CNPJ') ?? text(partyData, 'CPF'))}   IE: ${text(partyData, 'IE') ?? '-'}`,
    `${text(address, 'xLgr') ?? '-'}, ${text(address, 'nro') ?? 's/n'} - ${text(address, 'xBairro') ?? '-'} - ${text(address, 'xMun') ?? '-'} / ${text(address, 'UF') ?? '-'} - CEP ${formatCep(text(address, 'CEP'))}`,
  ]);
}

function buildPdf(pages: PdfLine[][]): Buffer {
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const pageIds = pages.map((_, index) => 3 + index * 2);
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  pages.forEach((page, index) => {
    const pageId = pageIds[index] as number;
    const contentId = pageId + 1;
    const stream = page.map(toPdfText).join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${pageIds.length * 2 + 3} 0 R /F2 ${pageIds.length * 2 + 4} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

function toPdfText(line: PdfLine): string {
  return `BT /${line.font ?? 'F1'} ${line.size ?? 8} Tf ${line.x} ${line.y} Td (${escapePdf(line.text)}) Tj ET`;
}

function current<T>(items: T[]): T {
  return items[items.length - 1] as T;
}

function objectAt(value: unknown, path: string[]): Record<string, unknown> | null {
  const found = valueAt(value, path);
  return typeof found === 'object' && found !== null && !Array.isArray(found)
    ? (found as Record<string, unknown>)
    : null;
}

function valueAt(value: unknown, path: string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function text(value: Record<string, unknown>, key: string): string | null {
  const found = value[key];
  if (typeof found === 'string' || typeof found === 'number' || typeof found === 'bigint') {
    return String(found);
  }
  return null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value))
    return value.filter((item) => typeof item === 'object' && item !== null) as Record<
      string,
      unknown
    >[];
  if (typeof value === 'object' && value !== null) return [value as Record<string, unknown>];
  return [];
}

function escapePdf(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function fit(value: string, size: number): string {
  return value.length <= size ? value : `${value.slice(0, Math.max(0, size - 3))}...`;
}

function groupChave(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (!digits) return '-';
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function idToChave(id: string | null): string | null {
  return id?.replace(/^NFe/, '') ?? null;
}

function formatDoc(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (digits.length === 14)
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return value ?? '-';
}

function formatCep(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length === 8 ? digits.replace(/^(\d{5})(\d{3})$/, '$1-$2') : (value ?? '-');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function money(value: string | null | undefined): string {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(parsed) ? parsed : 0,
  );
}

function qty(value: string | null | undefined): string {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(
    Number.isFinite(parsed) ? parsed : 0,
  );
}

function frete(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    '0': '0 - Por conta do emitente',
    '1': '1 - Por conta do destinatario',
    '2': '2 - Por conta de terceiros',
    '9': '9 - Sem frete',
  };
  return labels[value ?? ''] ?? value ?? '-';
}
