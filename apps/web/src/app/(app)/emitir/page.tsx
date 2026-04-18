import { Card, CardContent, CardHeader, CardTitle } from '@nexo/ui';

export const metadata = { title: 'Emitir Nota' };

export default function EmitirPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Emitir Nota</h1>
        <p className="text-muted-foreground">NFS-e, NF-e ou Devolução.</p>
      </div>

      {/* Aviso exibido apenas em mobile — FOUND-16 (degradação explícita em mobile) */}
      <Card className="md:hidden border-brand-warning bg-brand-warning/10">
        <CardHeader>
          <CardTitle className="text-brand-warning">
            Tela maior necessária
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          A emissão de nota fiscal requer tela de tablet ou desktop. Acesse de um
          aparelho maior para continuar.
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Em breve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Emissão implementada nas Phases 3 (NF-e modelo 55) e 4 (NFS-e + Devolução).
        </CardContent>
      </Card>
    </div>
  );
}
