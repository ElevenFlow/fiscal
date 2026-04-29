'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@nexo/ui';
import { Copy, Download, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type AuditRow = {
  id: string;
  usuario: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  diff: unknown;
  ip: string | null;
  userAgent: string | null;
  result: 'success' | 'failure';
  createdAt: string;
};

export function AuditoriaClient() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (result) qs.set('result', result);
      if (resourceType.trim()) qs.set('resourceType', resourceType.trim());
      const res = await fetch(`/api/auditoria?${qs.toString()}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar auditoria');
      setRows(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  }, [resourceType, result, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const resourceTypes = useMemo(
    () => Array.from(new Set(rows.map((row) => row.resourceType).filter(Boolean))) as string[],
    [rows],
  );

  const exportCsv = () => {
    const csv = [
      'createdAt,usuario,action,resourceType,resourceId,result,ip',
      ...rows.map((row) =>
        [
          row.createdAt,
          row.usuario,
          row.action,
          row.resourceType ?? '',
          row.resourceId ?? '',
          row.result,
          row.ip ?? '',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(csv).catch(() => undefined);
    }
    toast.success('CSV copiado para a área de transferência');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs e Auditoria</h1>
          <p className="text-muted-foreground">
            Trilha imutável de ações críticas com filtros e diff antes/depois.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuário, ação, entidade ou IP..."
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os resultados</option>
            <option value="success">Sucesso</option>
            <option value="failure">Falha</option>
          </select>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas as entidades</option>
            {resourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 text-right font-medium">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.id}-${row.createdAt}`} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {new Date(row.createdAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3">{row.usuario}</td>
                <td className="px-4 py-3">{row.action}</td>
                <td className="px-4 py-3">
                  <div>{row.resourceType ?? '-'}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.resourceId ?? '-'}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {row.ip ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={row.result === 'success' ? 'success' : 'destructive'}>
                    {row.result === 'success' ? 'Sucesso' : 'Falha'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setSelected(row)}>
                    Ver diff
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum log encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Log {selected.id.slice(0, 8)}</SheetTitle>
                <SheetDescription>Registro imutável de auditoria.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Ação</dt>
                    <dd>{selected.action}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Usuário</dt>
                    <dd>{selected.usuario}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">User-agent</dt>
                    <dd className="break-all font-mono text-xs text-muted-foreground">
                      {selected.userAgent ?? '-'}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Diff</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const text = JSON.stringify(selected.diff ?? null, null, 2);
                      navigator.clipboard?.writeText(text).catch(() => undefined);
                      toast.success('Diff copiado');
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                </div>
                <pre className="max-h-[460px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(selected.diff ?? null, null, 2)}
                </pre>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
