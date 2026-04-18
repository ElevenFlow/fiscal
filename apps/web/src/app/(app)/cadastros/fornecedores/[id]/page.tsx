import { fornecedores } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { FornecedorForm } from '../fornecedor-form';

export const metadata = { title: 'Editar fornecedor' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarFornecedorPage({ params }: PageProps) {
  const { id } = await params;
  const fornecedor = fornecedores.find((f) => f.id === id);
  if (!fornecedor) notFound();
  return <FornecedorForm mode="edit" initial={fornecedor} />;
}
