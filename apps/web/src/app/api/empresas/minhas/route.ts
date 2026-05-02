import { ApiError, fetchApi } from '@/lib/api-client';
import { NextResponse } from 'next/server';

/**
 * Route Handler: GET /api/empresas/minhas (Plan 02-09).
 *
 * Em modo Clerk (default): proxia para apps/api `/api/empresas/minhas` injetando
 * Bearer JWT via fetchApi → apps/api filtra por contabilidade do user autenticado.
 *
 * Wave 1: o endpoint upstream em apps/api ainda não existe (Plan 02-02 entrega).
 * Quando 404/erro, fallback para fixture mock para EmpresaSwitcher continuar
 * funcionando até Phase 2 conectar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface EmpresaDTO {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente: 'producao' | 'homologacao';
}

const fallbackEmpresas: EmpresaDTO[] = [
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

export async function GET(): Promise<NextResponse> {
  try {
    const data = await fetchApi<EmpresaDTO[] | { empresas: EmpresaDTO[] }>('/api/empresas/minhas');
    const empresas = Array.isArray(data) ? data : data.empresas;
    return NextResponse.json({ empresas }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    // Plan 02-02 entregará o endpoint apps/api; até lá, mock mantém UI viva.
    if (
      err instanceof ApiError &&
      (err.status === 404 || err.status === 401 || err.status === 500)
    ) {
      return NextResponse.json(
        { empresas: fallbackEmpresas },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { empresas: fallbackEmpresas },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
