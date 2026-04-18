import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata = { title: 'Auditoria' };

export default function AuditoriaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground">
          Trilha imutável de ações críticas (login, emissão, cancelamento, permissões).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Visualização de <code className="font-mono">audit_log</code> implementada na Phase 6.
        </CardContent>
      </Card>
    </div>
  );
}
