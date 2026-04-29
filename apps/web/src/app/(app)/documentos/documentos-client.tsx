'use client';

import { Badge, Button, Card, CardContent, Money, StatusPill, cn } from '@nexo/ui';
import { Download, FileArchive, FileCode, FileText, RefreshCw } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Documento = {
  id: string;
  modelo: 'NFE_55' | 'NFSE' | 'DEVOLUCAO';
  modeloLabel: string;
  serie: number;
  numero: string | null;
  chaveAcesso: string | null;
  status: string;
  statusLabel: string;
  participanteNome: string | null;
  valorTotal: number;
  xmlDisponivel: boolean;
  pdfDisponivel: boolean;
  createdAt: string;
  timeline: Array<{
    id: string;
    action: string;
    status: string;
    mensagem: string | null;
    createdAt: string;
  }>;
};

type TipoFiltro = 'todos' | 'NFE_55' | 'NFSE' | 'DEVOLUCAO';

const TABS: Array<{ value: TipoFiltro; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'NFE_55', label: 'NF-e' },
  { value: 'NFSE', label: 'NFS-e' },
  { value: 'DEVOLUCAO', label: 'Devolucoes' },
];

const STATUS_TO_PILL: Record<
  string,
  'autorizada' | 'rejeitada' | 'cancelada' | 'pendente' | 'processando' | 'rascunho'
> = {
  AUTHORIZED: 'autorizada',
  CANCELLED: 'cancelada',
  REJECTED: 'rejeitada',
  PENDING_RESPONSE: 'pendente',
  TRANSMITTING: 'processando',
  SIGNING: 'processando',
  DRAFT: 'rascunho',
};

export function DocumentosClient() {
  const [rows, setRows] = useState<Documento[]>([]);
  const [tipo, setTipo] = useState<TipoFiltro>('todos');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('tipo', tipo);
      if (search.trim()) qs.set('search', search.trim());
      if (status) qs.set('status', status);
      const res = await fetch(`/api/documentos?${qs.toString()}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar documentos');
      setRows(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }, [tipo, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalValor = useMemo(() => rows.reduce((sum, row) => sum + row.valorTotal, 0), [rows]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportar = async (formato: 'csv' | 'zip') => {
    if (selected.size === 0) {
      toast.error('Selecione ao menos um documento.');
      return;
    }
    const res = await fetch('/api/documentos/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), formato }),
    });
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload?.message ?? 'Falha ao exportar');
      return;
    }
    if (payload.disponivel === false) {
      toast.info(payload.message);
      return;
    }
    toast.success(`${payload.filename} gerado`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentos fiscais</h1>
          <p className="text-muted-foreground">
            <strong>{rows.length}</strong> documentos. Total:{' '}
            <Money value={totalValor} className="font-semibold text-foreground" />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportar('csv')}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => exportar('zip')}>
            <FileArchive className="mr-2 h-4 w-4" />
            ZIP/XML/PDF
          </Button>
          <Button variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setTipo(tab.value)}
            className={cn(
              'min-w-fit rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tipo === tab.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por numero, chave, participante ou tipo..."
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="AUTHORIZED">Autorizada</option>
            <option value="REJECTED">Rejeitada</option>
            <option value="CANCELLED">Cancelada</option>
            <option value="DRAFT">Rascunho</option>
            <option value="PENDING_RESPONSE">Pendente</option>
          </select>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Numero</th>
              <th className="px-3 py-2 font-medium">Participante</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Arquivos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((doc) => (
              <Fragment key={doc.id}>
                <tr className="border-t">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(doc.id)}
                      onChange={() => toggle(doc.id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="secondary">{doc.modeloLabel}</Badge>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {doc.serie}/{doc.numero ?? '-'}
                    <button
                      type="button"
                      className="ml-2 text-brand-blue"
                      onClick={() => setExpanded(expanded === doc.id ? null : doc.id)}
                    >
                      timeline
                    </button>
                  </td>
                  <td className="px-3 py-3">{doc.participanteNome ?? '-'}</td>
                  <td className="px-3 py-3 text-right">
                    <Money value={doc.valorTotal} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill
                      status={STATUS_TO_PILL[doc.status] ?? 'rascunho'}
                      label={doc.statusLabel}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" asChild disabled={!doc.xmlDisponivel}>
                        <a
                          href={
                            doc.modelo === 'NFSE'
                              ? `/api/fiscal/nfse/${doc.id}/xml`
                              : doc.modelo === 'DEVOLUCAO'
                                ? `/api/fiscal/devolucoes/${doc.id}/xml`
                                : `/api/fiscal/nfe/${doc.id}/xml`
                          }
                        >
                          <FileCode className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="ghost" asChild disabled={!doc.pdfDisponivel}>
                        <a
                          href={
                            doc.modelo === 'NFSE'
                              ? `/api/fiscal/nfse/${doc.id}/danfse`
                              : doc.modelo === 'DEVOLUCAO'
                                ? `/api/fiscal/devolucoes/${doc.id}/danfe`
                                : `/api/fiscal/nfe/${doc.id}/danfe`
                          }
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
                {expanded === doc.id ? (
                  <tr className="border-t bg-muted/20">
                    <td colSpan={7} className="px-6 py-3">
                      <ol className="space-y-2 text-xs">
                        {doc.timeline.length === 0 ? (
                          <li className="text-muted-foreground">Sem eventos.</li>
                        ) : null}
                        {doc.timeline.map((event) => (
                          <li key={event.id} className="flex items-start justify-between gap-4">
                            <span>
                              <strong>{event.status}</strong> - {event.mensagem ?? event.action}
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {new Date(event.createdAt).toLocaleString('pt-BR')}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  Nenhum documento encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
