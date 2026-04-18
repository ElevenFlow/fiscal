import type { Metadata } from 'next';
import { RevisarClient } from './revisar-client';

export const metadata: Metadata = { title: 'Revisão de Importação' };

export default async function RevisarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RevisarClient id={id} />;
}
