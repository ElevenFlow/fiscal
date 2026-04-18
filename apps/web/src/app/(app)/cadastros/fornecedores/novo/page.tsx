import { FornecedorForm } from '../fornecedor-form';

export const metadata = { title: 'Novo fornecedor' };

export default function NovoFornecedorPage() {
  return <FornecedorForm mode="create" />;
}
