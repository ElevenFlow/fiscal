import { ProdutoForm } from '../produto-form';

export const metadata = { title: 'Novo produto' };

export default function NovoProdutoPage() {
  return <ProdutoForm mode="create" />;
}
