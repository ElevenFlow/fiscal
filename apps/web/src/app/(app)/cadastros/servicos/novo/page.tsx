import { ServicoForm } from '../servico-form';

export const metadata = { title: 'Novo serviço' };

export default function NovoServicoPage() {
  return <ServicoForm mode="create" />;
}
