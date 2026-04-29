'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  cn,
} from '@nexo/ui';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type TipoMov = 'entrada' | 'saida' | 'ajuste' | 'estorno';
type TipoFiltro = '' | TipoMov;
type OrigemFiltro = '' | 'xml' | 'nfe' | 'manual';

interface MovimentacaoEstoque {
  id: string;
  createdAt: string;
  produtoId: string | null;
  produtoCodigo: string;
  produtoDescricao: string;
  tipo: TipoMov;
  origem: 'xml' | 'nfe' | 'manual';
  quantidade: string;
  saldoApos: string;
  motivo: string;
}

interface ProdutoEstoque {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  saldoAtual: number;
  estoqueCritico: boolean;
}

const MOTIVOS = ['Inventario', 'Perda', 'Quebra', 'Doacao', 'Outro'] as const;

export function EstoqueClient() {
  const [rows, setRows] = useState<MovimentacaoEstoque[]>([]);
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<TipoFiltro>('');
  const [origem, setOrigem] = useState<OrigemFiltro>('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (tipo) params.set('tipo', tipo);
      if (origem) params.set('origem', origem);
      if (dataInicio) params.set('dataInicio', dataInicio);
      if (dataFim) params.set('dataFim', dataFim);
      const [movRes, posRes] = await Promise.all([
        fetch(`/api/estoque/movimentacoes?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/estoque/posicao', { cache: 'no-store' }),
      ]);
      if (!movRes.ok) throw new Error('Falha ao carregar movimentacoes');
      setRows(await movRes.json());
      setProdutos(posRes.ok ? await posRes.json() : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar estoque');
    } finally {
      setLoading(false);
    }
  }, [search, tipo, origem, dataInicio, dataFim]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const clearFilters = () => {
    setSearch('');
    setTipo('');
    setOrigem('');
    setDataInicio('');
    setDataFim('');
    setPage(1);
  };

  const kpis = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let ajustes = 0;
    for (const r of rows) {
      const qtd = Math.abs(Number(r.quantidade));
      if (r.tipo === 'entrada') entradas += qtd;
      else if (r.tipo === 'saida') saidas += qtd;
      else ajustes += qtd;
    }
    const criticos = produtos.filter((p) => p.estoqueCritico).length;
    return { entradas, saidas, ajustes, criticos };
  }, [rows, produtos]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { descricao: string; count: number }>();
    for (const r of rows) {
      const existing = map.get(r.produtoCodigo);
      if (existing) existing.count += 1;
      else map.set(r.produtoCodigo, { descricao: r.produtoDescricao, count: 1 });
    }
    const arr = Array.from(map.entries())
      .map(([sku, v]) => ({ sku, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const max = arr[0]?.count ?? 1;
    return arr.map((p) => ({ ...p, pct: Math.round((p.count / max) * 100) }));
  }, [rows]);

  const columns: DataTableColumn<MovimentacaoEstoque>[] = [
    {
      key: 'data',
      header: 'Data',
      render: (m) => (
        <span className="font-mono text-xs">
          {new Date(m.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'produto',
      header: 'Produto',
      render: (m) => (
        <div>
          <div className="font-medium">{m.produtoDescricao}</div>
          <div className="font-mono text-xs text-muted-foreground">{m.produtoCodigo}</div>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (m) => <TipoBadge tipo={m.tipo} />,
    },
    {
      key: 'quantidade',
      header: 'Qtd',
      align: 'right',
      render: (m) => {
        const qtd = Number(m.quantidade);
        const cor = qtd >= 0 ? 'text-brand-green' : 'text-brand-danger';
        return <span className={cn('font-mono font-semibold tabular-nums', cor)}>{qtd}</span>;
      },
    },
    {
      key: 'origem',
      header: 'Origem',
      render: (m) => (
        <span className="text-xs">
          {m.origem === 'xml' ? 'XML importado' : m.origem === 'manual' ? 'Manual' : 'NF-e'}
        </span>
      ),
    },
    {
      key: 'saldo',
      header: 'Saldo apos',
      align: 'right',
      render: (m) => (
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            Number(m.saldoApos) < 0 && 'text-brand-danger',
          )}
        >
          {Number(m.saldoApos)}
        </span>
      ),
    },
    {
      key: 'motivo',
      header: 'Motivo',
      render: (m) => <span className="text-xs text-muted-foreground">{m.motivo}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentacoes de Estoque</h1>
          <p className="text-muted-foreground">Historico completo de entradas, saidas e ajustes.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajuste manual
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex min-h-[240px] items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Carregando estoque...
              </CardContent>
            </Card>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowId={(m) => m.id}
              search={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              searchPlaceholder="Buscar por produto ou SKU..."
              filters={
                <>
                  <select
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value as TipoFiltro);
                      setPage(1);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Tipo"
                  >
                    <option value="">Todos os tipos</option>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saida</option>
                    <option value="ajuste">Ajuste</option>
                    <option value="estorno">Estorno</option>
                  </select>
                  <select
                    value={origem}
                    onChange={(e) => {
                      setOrigem(e.target.value as OrigemFiltro);
                      setPage(1);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Origem"
                  >
                    <option value="">Todas as origens</option>
                    <option value="xml">XML importado</option>
                    <option value="nfe">NF-e emitida</option>
                    <option value="manual">Manual</option>
                  </select>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Data de inicio"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => {
                      setDataFim(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Data de fim"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </>
              }
              onClearFilters={clearFilters}
              page={page}
              pageSize={10}
              onPageChange={setPage}
              totalLabelSingular="movimentacao"
              totalLabelPlural="movimentacoes"
              emptyTitle="Nenhuma movimentacao encontrada"
              emptyDescription="Importe um XML ou registre um ajuste manual."
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <h3 className="text-sm font-semibold">Resumo do periodo</h3>
                <p className="text-xs text-muted-foreground">KPIs das movimentacoes filtradas.</p>
              </div>
              <div className="space-y-2">
                <KpiLine
                  icon={<ArrowUp className="h-4 w-4" />}
                  label="Total entradas"
                  value={`${kpis.entradas} un`}
                  tone="success"
                />
                <KpiLine
                  icon={<ArrowDown className="h-4 w-4" />}
                  label="Total saidas"
                  value={`${kpis.saidas} un`}
                  tone="danger"
                />
                <KpiLine
                  icon={<RefreshCw className="h-4 w-4" />}
                  label="Ajustes"
                  value={`${kpis.ajustes} un`}
                  tone="info"
                />
                <Link
                  href="/cadastros/produtos?estoqueCritico=true"
                  className="flex items-center justify-between rounded-md border border-brand-warning/30 bg-brand-warning/5 px-3 py-2 text-sm transition-colors hover:bg-brand-warning/10"
                >
                  <span className="flex items-center gap-2 text-brand-warning">
                    <AlertTriangle className="h-4 w-4" />
                    Produtos em estoque critico
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-brand-warning">
                    {kpis.criticos}
                  </span>
                </Link>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Top 5 mais movimentados
                </h4>
                {topProdutos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem movimentacoes no periodo.</p>
                ) : (
                  <ul className="space-y-2">
                    {topProdutos.map((p) => (
                      <li key={p.sku}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-medium">{p.descricao}</span>
                          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                            {p.count}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-brand-blue" style={{ width: `${p.pct}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AjusteManualDialog
        open={dialogOpen}
        produtos={produtos}
        onOpenChange={setDialogOpen}
        onSaved={() => void carregar()}
      />
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: TipoMov }) {
  if (tipo === 'entrada') {
    return (
      <Badge
        variant="secondary"
        className="bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
      >
        <ArrowUp className="mr-1 h-3 w-3" />
        Entrada
      </Badge>
    );
  }
  if (tipo === 'saida') {
    return (
      <Badge
        variant="secondary"
        className="bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20"
      >
        <ArrowDown className="mr-1 h-3 w-3" />
        Saida
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20">
      <RefreshCw className="mr-1 h-3 w-3" />
      {tipo === 'estorno' ? 'Estorno' : 'Ajuste'}
    </Badge>
  );
}

function KpiLine({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'danger' | 'info';
}) {
  const toneCls =
    tone === 'success'
      ? 'text-brand-green'
      : tone === 'danger'
        ? 'text-brand-danger'
        : 'text-brand-blue';
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span className={cn('flex items-center gap-2', toneCls)}>
        {icon}
        {label}
      </span>
      <span className={cn('font-mono font-semibold tabular-nums', toneCls)}>{value}</span>
    </div>
  );
}

function AjusteManualDialog({
  open,
  produtos,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  produtos: ProdutoEstoque[];
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [produtoId, setProdutoId] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'saida' | 'ajuste'>('ajuste');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]>('Inventario');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setProdutoId('');
    setTipo('ajuste');
    setQuantidade('');
    setMotivo('Inventario');
  };

  const submit = async () => {
    if (!produtoId || !quantidade) {
      toast.error('Selecione um produto e informe a quantidade.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/estoque/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtoId, tipo, quantidade, motivo }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao registrar ajuste');
      toast.success('Movimentacao registrada');
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao registrar ajuste');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajuste manual de estoque</DialogTitle>
          <DialogDescription>
            Registre uma entrada, saida ou ajuste com motivo obrigatorio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="produto" className="mb-1 block text-xs font-medium">
              Produto
            </label>
            <select
              id="produto"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione um produto...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.descricao} ({p.codigo}) - saldo {p.saldoAtual}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium">Tipo</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Tipo de movimentacao">
              {(['entrada', 'saida', 'ajuste'] as const).map((t) => (
                <label
                  key={t}
                  className={cn(
                    'flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-xs font-medium transition-colors',
                    tipo === t
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-input bg-background hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="sr-only"
                  />
                  {t === 'entrada' ? 'Entrada' : t === 'saida' ? 'Saida' : 'Ajuste'}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="qtd" className="mb-1 block text-xs font-medium">
                Quantidade
              </label>
              <input
                id="qtd"
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                min="0"
                step="0.001"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="motivo" className="mb-1 block text-xs font-medium">
                Motivo
              </label>
              <select
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as (typeof MOTIVOS)[number])}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
