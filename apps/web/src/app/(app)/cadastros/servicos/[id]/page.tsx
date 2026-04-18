import { servicos } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { ServicoForm } from '../servico-form';

export const metadata = { title: 'Editar serviço' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarServicoPage({ params }: PageProps) {
  const { id } = await params;
  const servico = servicos.find((s) => s.id === id);
  if (!servico) notFound();
  return <ServicoForm mode="edit" initial={servico} />;
}
