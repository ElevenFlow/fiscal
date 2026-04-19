import type { Metadata } from 'next';
import { NfeClient } from './nfe-client';

export const metadata: Metadata = { title: 'Emitir NF-e' };

export default function EmitirNfePage() {
  return <NfeClient />;
}
