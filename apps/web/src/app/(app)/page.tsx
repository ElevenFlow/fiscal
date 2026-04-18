import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nexo/ui';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da plataforma Nexo Fiscal.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
          <CardDescription>
            Este dashboard será implementado na Phase 6 com os três painéis (Admin, Contabilidade,
            Empresa).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Phase 1 entrega a fundação de segurança (auth, RLS, audit, shell UI).
        </CardContent>
      </Card>
    </div>
  );
}
