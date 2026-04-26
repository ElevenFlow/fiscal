'use client';

/**
 * Edição de Contabilidade — Plan 02-07 Task 3.
 */

import { ContabilidadeForm, type ContabilidadeInitial } from '../contabilidade-form';
import { useQuery } from '@tanstack/react-query';
import { notFound, useParams } from 'next/navigation';

export default function EditarContabilidadePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const { data, isLoading, error } = useQuery<ContabilidadeInitial>({
    queryKey: ['contabilidade', id],
    queryFn: async () => {
      const res = await fetch(`/api/contabilidades/${id}`);
      if (res.status === 404) throw new Error('NOT_FOUND');
      if (!res.ok) throw new Error('Falha ao carregar contabilidade');
      return (await res.json()) as ContabilidadeInitial;
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

  return <ContabilidadeForm mode="edit" initial={{ ...data, id }} />;
}
