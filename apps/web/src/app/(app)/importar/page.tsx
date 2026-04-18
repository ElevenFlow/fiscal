import type { Metadata } from 'next';
import { ImportarClient } from './importar-client';

export const metadata: Metadata = { title: 'Importar XML' };

export default function ImportarPage() {
  return <ImportarClient />;
}
