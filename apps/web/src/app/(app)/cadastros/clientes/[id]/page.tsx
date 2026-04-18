import { clientes } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { ClienteForm } from '../cliente-form';

export const metadata = { title: 'Editar cliente' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarClientePage({ params }: PageProps) {
  const { id } = await params;
  const cliente = clientes.find((c) => c.id === id);
  if (!cliente) notFound();
  return <ClienteForm mode="edit" initial={cliente} />;
}
