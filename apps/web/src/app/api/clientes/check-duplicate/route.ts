/**
 * Route Handler proxy: /api/clientes/check-duplicate (Plan 02-07 Task 2 + Plan 02-03 CAD-09).
 *
 * Consultado em onBlur do campo CPF/CNPJ no form de cliente. Backend valida
 * dígito verificador antes de query — sem oracle de existência cross-tenant.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, fetchApi } from '@/lib/api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cpfCnpj = req.nextUrl.searchParams.get('cpfCnpj');
  if (!cpfCnpj) {
    return NextResponse.json(
      { code: 'MISSING_PARAM', message: 'cpfCnpj é obrigatório' },
      { status: 400 },
    );
  }
  // Sanitização defensiva: só dígitos
  const sanitized = cpfCnpj.replace(/\D/g, '');
  if (sanitized.length !== 11 && sanitized.length !== 14) {
    return NextResponse.json({ exists: false });
  }
  try {
    const data = await fetchApi(
      `/api/clientes/check-duplicate?cpfCnpj=${encodeURIComponent(sanitized)}`,
    );
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof ApiError) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(err.bodyText);
      } catch {
        parsed = { code: 'UPSTREAM_ERROR', message: err.bodyText };
      }
      return NextResponse.json(parsed, { status: err.status });
    }
    return NextResponse.json({ exists: false });
  }
}
