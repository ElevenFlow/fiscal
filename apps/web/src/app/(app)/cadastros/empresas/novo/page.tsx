import { EmpresaForm } from '../empresa-form';

export const metadata = { title: 'Nova empresa' };

export default function NovaEmpresaPage() {
  return <EmpresaForm mode="create" />;
}
