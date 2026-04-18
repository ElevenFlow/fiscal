import { ClienteForm } from '../cliente-form';

export const metadata = { title: 'Novo cliente' };

export default function NovoClientePage() {
  return <ClienteForm mode="create" />;
}
