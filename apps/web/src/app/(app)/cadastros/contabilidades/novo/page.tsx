import { ContabilidadeForm } from '../contabilidade-form';

export const metadata = { title: 'Nova contabilidade' };

export default function NovaContabilidadePage() {
  return <ContabilidadeForm mode="create" />;
}
