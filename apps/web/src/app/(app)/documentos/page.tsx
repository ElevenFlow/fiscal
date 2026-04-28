import type { Metadata } from 'next';
import { DocumentosClient } from './documentos-client';
import { DocumentosReaisClient } from './documentos-reais-client';

export const metadata: Metadata = { title: 'Documentos fiscais' };

export default function DocumentosPage() {
  return (
    <div className="space-y-6">
      <DocumentosReaisClient />
      <DocumentosClient />
    </div>
  );
}
