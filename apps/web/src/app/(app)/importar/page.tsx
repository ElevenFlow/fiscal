import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata = { title: 'Importar XML' };

export default function ImportarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar XML</h1>
        <p className="text-muted-foreground">
          Upload múltiplo de XML de compra com matching automático e atualização de estoque.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Funcionalidade implementada na Phase 5 (Importação XML + Estoque).
        </CardContent>
      </Card>
    </div>
  );
}
