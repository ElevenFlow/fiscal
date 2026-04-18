import { produtos } from '@/lib/mock-data';
import { notFound } from 'next/navigation';
import { ProdutoForm } from '../produto-form';

export const metadata = { title: 'Editar produto' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarProdutoPage({ params }: PageProps) {
  const { id } = await params;
  const produto = produtos.find((p) => p.id === id);
  if (!produto) notFound();
  return <ProdutoForm mode="edit" initial={produto} />;
}
