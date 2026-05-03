import { CadastrosHubCards } from './hub-cards';

export const metadata = { title: 'Cadastros' };

export default function CadastrosHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
        <p className="text-muted-foreground">
          Base mestre de empresas, contabilidades, parceiros e catálogo. Tudo o que alimenta a
          emissão fiscal está aqui.
        </p>
      </div>

      <CadastrosHubCards />
    </div>
  );
}
