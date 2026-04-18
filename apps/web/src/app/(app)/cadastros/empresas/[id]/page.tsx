import { empresas } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { EmpresaForm } from '../empresa-form';

export const metadata = { title: 'Editar empresa' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarEmpresaPage({ params }: PageProps) {
  const { id } = await params;
  const empresa = empresas.find((e) => e.id === id);
  if (!empresa) notFound();
  return <EmpresaForm mode="edit" initialEmpresa={empresa} />;
}
