'use client';

/**
 * DuplicateWarning — Plan 02-07 Task 2.
 *
 * Componente que renderiza alerta inline quando um CPF/CNPJ já existe no
 * tenant atual. Aciona /api/{resource}/check-duplicate?cpfCnpj=... do
 * Plan 02-03 com debounce 400ms ao terminar 11 ou 14 dígitos.
 *
 * Defesa T-02-07-03: o backend filtra por requireTenant() — sem tenant
 * retorna {exists:false}; cross-tenant nunca vaza.
 */

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface DuplicateInfo {
  exists: boolean;
  cliente?: { id: string; nome: string };
  fornecedor?: { id: string; razaoSocial: string };
}

interface DuplicateWarningProps {
  resource: 'clientes' | 'fornecedores';
  cpfCnpj: string;
  /** Em modo edição, ignora o próprio id (não alerta sobre si mesmo). */
  ignoreId?: string;
}

export function DuplicateWarning({ resource, cpfCnpj, ignoreId }: DuplicateWarningProps) {
  const [info, setInfo] = useState<DuplicateInfo | null>(null);

  useEffect(() => {
    const sanitized = cpfCnpj.replace(/\D/g, '');
    if (sanitized.length !== 11 && sanitized.length !== 14) {
      setInfo(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/${resource}/check-duplicate?cpfCnpj=${encodeURIComponent(sanitized)}`,
        );
        if (res.ok) setInfo((await res.json()) as DuplicateInfo);
      } catch {
        /* silent */
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [resource, cpfCnpj]);

  if (!info?.exists) return null;
  const item = info.cliente ?? info.fornecedor;
  if (item && ignoreId && item.id === ignoreId) return null;

  const nome = info.cliente?.nome ?? info.fornecedor?.razaoSocial;
  const id = item?.id;

  return (
    <div className="mt-1 flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1">
        Já existe um cadastro com esse CPF/CNPJ
        {nome ? (
          <>
            : <strong>{nome}</strong>
          </>
        ) : null}
        .
        {id ? (
          <>
            {' '}
            <Link
              href={`/cadastros/${resource}/${id}`}
              className="ml-1 underline font-medium"
            >
              Abrir cadastro existente
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
