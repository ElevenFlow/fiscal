import { NextResponse } from 'next/server';

/**
 * MODO PROTÓTIPO: retorna lista mock de empresas visíveis ao usuário.
 *
 * No modo real (ver git log 01-07/01-09), o handler proxy para apps/api
 * GET /api/empresas/minhas usando JWT Clerk. Aqui só devolve as empresas
 * do fixture para manter compatibilidade com `empresa-switcher.tsx` enquanto
 * este componente é migrado para consumir `mock-data.ts` direto.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface EmpresaDTO {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente: 'producao' | 'homologacao';
}

export async function GET(): Promise<NextResponse> {
  const empresas: EmpresaDTO[] = [
    {
      id: 'e-1',
      razaoSocial: 'Oliveira Tech Soluções LTDA',
      cnpj: '12.345.678/0001-90',
      ambiente: 'producao',
    },
    {
      id: 'e-2',
      razaoSocial: 'Clínica Vida Integral ME',
      cnpj: '23.456.789/0001-12',
      ambiente: 'producao',
    },
    {
      id: 'e-3',
      razaoSocial: 'Solar Engenharia LTDA',
      cnpj: '34.567.890/0001-23',
      ambiente: 'homologacao',
    },
  ];
  return NextResponse.json({ empresas }, { headers: { 'Cache-Control': 'no-store' } });
}
