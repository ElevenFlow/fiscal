import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata = { title: 'Estoque' };

export default function EstoquePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
        <p className="text-muted-foreground">
          Movimentações, posição atual e alertas de estoque mínimo.
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
