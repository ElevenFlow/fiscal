import type { Metadata } from 'next';
import { NfeClient } from './nfe-client';
import { NfeOperacionalClient } from './nfe-operacional-client';

export const metadata: Metadata = { title: 'Emitir NF-e' };

export default function EmitirNfePage() {
  return (
    <div className="space-y-6">
      <NfeOperacionalClient />
      <NfeClient />
    </div>
  );
}
