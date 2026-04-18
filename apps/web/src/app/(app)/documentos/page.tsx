import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata = { title: 'Documentos Fiscais' };

export default function DocumentosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentos Fiscais</h1>
        <p className="text-muted-foreground">
          NFS-e, NF-e e Devoluções consolidadas em uma única tela.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Funcionalidade implementada na Phase 6 (Documentos + Alertas + Dashboards).
        </CardContent>
      </Card>
    </div>
  );
}
