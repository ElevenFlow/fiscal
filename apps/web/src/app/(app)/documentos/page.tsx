import type { Metadata } from 'next';
import { DocumentosClient } from './documentos-client';

export const metadata: Metadata = { title: 'Documentos fiscais' };

export default function DocumentosPage() {
  return <DocumentosClient />;
}
