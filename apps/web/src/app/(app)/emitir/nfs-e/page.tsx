import type { Metadata } from 'next';
import { NfseClient } from './nfse-client';

export const metadata: Metadata = { title: 'Emitir NFS-e' };

export default function EmitirNfsePage() {
  return <NfseClient />;
}
