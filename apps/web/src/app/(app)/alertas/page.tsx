import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata = { title: 'Central de Alertas' };

export default function AlertasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Central de Alertas</h1>
        <p className="text-muted-foreground">
          Central de alertas por severidade (crítico, atenção, informativo).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Funcionalidade implementada na Phase 6 com regras scheduled + event-driven.
        </CardContent>
      </Card>
    </div>
  );
}
