'use client';

/**
 * Edição de Empresa — Plan 02-07 Task 3.
 */

import { EmpresaForm, type EmpresaInitial } from '../empresa-form';
import { useQuery } from '@tanstack/react-query';
import { notFound, useParams } from 'next/navigation';

export default function EditarEmpresaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const { data, isLoading, error } = useQuery<EmpresaInitial>({
    queryKey: ['empresa', id],
    queryFn: async () => {
      const res = await fetch(`/api/empresas/${id}`);
      if (res.status === 404) throw new Error('NOT_FOUND');
      if (!res.ok) throw new Error('Falha ao carregar empresa');
      return (await res.json()) as EmpresaInitial;
    },
    enabled: Boolean(id),
  });

  if (error && (error as Error).message === 'NOT_FOUND') notFound();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-64 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return <EmpresaForm mode="edit" initialEmpresa={{ ...data, id }} />;
}
