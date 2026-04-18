import { NextResponse } from 'next/server';

/**
 * MODO PROTÓTIPO: retorna um JSON mock fake sem auth e sem backend.
 *
 * No modo real (ver git log 01-09), este handler faz proxy autenticado via
 * `fetchApi` para apps/api GET /api/lgpd/export e force-download do conteúdo.
 */
export async function GET(): Promise<NextResponse> {
  const payload = {
    geradoEm: new Date().toISOString(),
    modo: 'prototipo-mock',
    usuario: {
      id: 'u-1',
      nome: 'Rodrigo Silva',
      email: 'rodrigo@oliveiratech.com.br',
      perfil: 'empresa',
    },
    empresas: [
      { id: 'e-1', razaoSocial: 'Oliveira Tech Soluções LTDA', cnpj: '12.345.678/0001-90' },
    ],
    auditoria: [
      { data: new Date().toISOString(), acao: 'login', ip: '127.0.0.1' },
      { data: new Date().toISOString(), acao: 'emissao_nfse', ip: '127.0.0.1' },
    ],
    observacao:
      'Este é um export simulado. No ambiente real os dados vêm do apps/api com filtros LGPD.',
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `nexofiscal-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
