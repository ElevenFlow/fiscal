'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, StatusPill } from '@nexo/ui';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

type NotaFiscalApi = {
  id: string;
  modelo: string;
  ambiente: string;
  serie: number;
  numero?: string | null;
  chaveAcesso?: string | null;
  status: string;
  protocoloAutorizacao?: string | null;
  xmlDisponivel?: boolean;
  danfeDisponivel?: boolean;
  createdAt: string;
};

const statusMap: Record<string, 'autorizada' | 'rejeitada' | 'cancelada' | 'pendente' | 'processando' | 'rascunho'> = {
  AUTHORIZED: 'autorizada',
  CANCELLED: 'cancelada',
  REJECTED: 'rejeitada',
  PENDING_RESPONSE: 'pendente',
  TRANSMITTING: 'processando',
  SIGNING: 'processando',
  DRAFT: 'rascunho',
};

export function DocumentosReaisClient() {
  const [notas, setNotas] = useState<NotaFiscalApi[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fiscal/nfe');
      setNotas(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Documentos NF-e reais</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulta os documentos criados pelo módulo SEFAZ-SC.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Modelo</th>
                <th className="px-3 py-2 font-medium">Número</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Chave</th>
                <th className="px-3 py-2 font-medium">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((nota) => (
                <tr key={nota.id} className="border-t">
                  <td className="px-3 py-2">{new Date(nota.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-2">
                    {nota.modelo} - {nota.ambiente}
                  </td>
                  <td className="px-3 py-2">
                    {nota.serie}/{nota.numero ?? '-'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={statusMap[nota.status] ?? 'rascunho'} label={nota.status} />
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2">{nota.chaveAcesso ?? '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" asChild disabled={!nota.xmlDisponivel}>
                        <a href={`/api/fiscal/nfe/${nota.id}/xml`} aria-label="Baixar XML">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="ghost" asChild disabled={!nota.danfeDisponivel}>
                        <a href={`/api/fiscal/nfe/${nota.id}/danfe`} aria-label="Baixar DANFE">
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {notas.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>
                    Nenhum documento NF-e real disponível.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
