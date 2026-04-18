import { fetchApi } from '@/lib/api-client';
import { NextResponse } from 'next/server';

/**
 * Route Handler proxy (BLOCKER #2 Option A — Plan 09) para EmpresaSwitcher.
 *
 * Client (browser, same-origin, cookie Clerk) → este handler → fetchApi(JWT Bearer) → apps/api.
 *
 * Stub neste plan: apps/api retorna lista placeholder. Phase 2 (CAD-02) pluga
 * query real `empresas ⋈ contabilidade_empresas ⋈ contabilidade (clerk_org_id)`.
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
  try {
    const data = await fetchApi<{ empresas: EmpresaDTO[] }>('/api/empresas/minhas');
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = (err as Error).message;
    // fetchApi lança com o status no message (ex: "failed: 401 ..."); distinguir auth
    const status = /\b40(1|3)\b/.test(msg) ? 401 : 500;
    return NextResponse.json({ error: 'Falha ao carregar empresas' }, { status });
  }
}
