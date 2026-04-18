import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata = { title: 'Cadastros' };

export default function CadastrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
        <p className="text-muted-foreground">
          Gerencie empresas, clientes, fornecedores, produtos e serviços.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Funcionalidade implementada na Phase 2 (Cadastros + Certificado A1 + Séries).
        </CardContent>
      </Card>
    </div>
  );
}
