import { contabilidades } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { ContabilidadeForm } from '../contabilidade-form';

export const metadata = { title: 'Editar contabilidade' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarContabilidadePage({ params }: PageProps) {
  const { id } = await params;
  const contabilidade = contabilidades.find((c) => c.id === id);
  if (!contabilidade) notFound();
  return <ContabilidadeForm mode="edit" initial={contabilidade} />;
}
