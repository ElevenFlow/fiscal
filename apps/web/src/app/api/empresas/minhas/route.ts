import { fetchApi } from '@/lib/api-client';
import { NextResponse } from 'next/server';

/**
 * Route Handler: GET /api/empresas/minhas.
 *
 * Retorna somente empresas reais do banco. Sem fallback mock: quando nao houver
 * empresa cadastrada, a resposta correta e uma lista vazia.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface EmpresaDTO {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente?: 'producao' | 'homologacao';
}

export async function GET(): Promise<NextResponse> {
  try {
    const data = await fetchApi<EmpresaDTO[] | { empresas: EmpresaDTO[] }>('/api/empresas/minhas');
    const empresas = Array.isArray(data) ? data : data.empresas;
    return NextResponse.json({ empresas }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao carregar empresas';
    return NextResponse.json(
      { empresas: [], code: 'EMPRESAS_FETCH_ERROR', message },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
