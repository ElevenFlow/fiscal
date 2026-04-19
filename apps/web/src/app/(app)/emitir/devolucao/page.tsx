import type { Metadata } from 'next';
import { DevolucaoClient } from './devolucao-client';

export const metadata: Metadata = { title: 'Emitir devolução' };

export default function EmitirDevolucaoPage() {
  return <DevolucaoClient />;
}
