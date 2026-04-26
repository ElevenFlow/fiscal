'use client';

/**
 * Edição de Cliente — Plan 02-07 Task 3.
 *
 * Faz fetch via TanStack Query do detalhe e renderiza ClienteForm com mode='edit'.
 * Em loading mostra esqueleto mínimo; em 404 chama notFound().
 */

import { ClienteForm, type ClienteInitial } from '../cliente-form';
import { useQuery } from '@tanstack/react-query';
import { notFound, useParams } from 'next/navigation';

export default function EditarClientePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const { data, isLoading, error } = useQuery<ClienteInitial>({
    queryKey: ['cliente', id],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${id}`);
      if (res.status === 404) throw new Error('NOT_FOUND');
      if (!res.ok) throw new Error('Falha ao carregar cliente');
      return (await res.json()) as ClienteInitial;
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

  return <ClienteForm mode="edit" initial={{ ...data, id }} />;
}
