'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import {
  type MovimentacaoEstoque,
  movimentacoesEstoque as fixtureMovs,
  produtos as fixtureProdutos,
} from '@/lib/mock-data';
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
import { AlertTriangle, ArrowDown, ArrowUp, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type TipoMov = 'entrada' | 'saida' | 'ajuste';
type TipoFiltro = '' | TipoMov;
type OrigemFiltro = '' | 'xml' | 'nfe' | 'manual';

// Movimentações adicionais para preencher a tabela — complementa as 5 fixture
// existentes. Totaliza ~20 linhas para demonstrar paginação e filtros.
const movsExtras: MovimentacaoEstoque[] = [
  {
    id: 'mv-6',
    data: '17/04/2026',
    produtoSku: 'CAB-FLEX-2.5',
    produtoDescricao: 'Cabo Flexível 2,5mm² 750V',
    tipo: 'entrada',
    quantidade: 30,
    origem: 'Importação XML — Distribuidora Sul Brasil',
    saldoApos: 72,
  },
  {
    id: 'mv-7',
    data: '16/04/2026',
    produtoSku: 'LED-LUM-18W',
    produtoDescricao: 'Luminária LED Plafon 18W',
    tipo: 'saida',
    quantidade: 12,
    origem: 'NF-e 001243',
    saldoApos: 45,
  },
  {
    id: 'mv-8',
    data: '15/04/2026',
    produtoSku: 'CXO-ORG-25L',
    produtoDescricao: 'Caixa Organizadora 25L',
    tipo: 'saida',
    quantidade: 14,
    origem: 'NF-e 001242',
    saldoApos: 120,
  },
  {
    id: 'mv-9',
    data: '14/04/2026',
    produtoSku: 'TEC-USB-BR01',
    produtoDescricao: 'Teclado USB ABNT2 Preto',
    tipo: 'saida',
    quantidade: 20,
    origem: 'NF-e 001240',
    saldoApos: 66,
  },
  {
    id: 'mv-10',
    data: '13/04/2026',
    produtoSku: 'DIS-20A-BIP',
    produtoDescricao: 'Disjuntor Bipolar 20A Curva C',
    tipo: 'entrada',
    quantidade: 20,
    origem: 'Importação XML — Eletro Norte',
    saldoApos: 10,
  },
  {
    id: 'mv-11',
    data: '12/04/2026',
    produtoSku: 'CAB-FLEX-2.5',
    produtoDescricao: 'Cabo Flexível 2,5mm² 750V',
    tipo: 'ajuste',
    quantidade: 2,
    origem: 'Ajuste manual — divergência',
    saldoApos: 50,
  },
  {
    id: 'mv-12',
    data: '11/04/2026',
    produtoSku: 'TEC-USB-BR01',
    produtoDescricao: 'Teclado USB ABNT2 Preto',
    tipo: 'entrada',
    quantidade: 30,
    origem: 'Importação XML — Atacado Central',
    saldoApos: 120,
  },
  {
    id: 'mv-13',
    data: '10/04/2026',
    produtoSku: 'LED-LUM-18W',
    produtoDescricao: 'Luminária LED Plafon 18W',
    tipo: 'saida',
    quantidade: 8,
    origem: 'NF-e 001238',
    saldoApos: 57,
  },
  {
    id: 'mv-14',
    data: '09/04/2026',
    produtoSku: 'CXO-ORG-25L',
    produtoDescricao: 'Caixa Organizadora 25L',
    tipo: 'entrada',
    quantidade: 50,
    origem: 'Importação XML — Distribuidora Sul Brasil',
    saldoApos: 134,
  },
  {
    id: 'mv-15',
    data: '08/04/2026',
    produtoSku: 'DIS-20A-BIP',
    produtoDescricao: 'Disjuntor Bipolar 20A Curva C',
    tipo: 'saida',
    quantidade: 6,
    origem: 'NF-e 001236',
    saldoApos: -4,
  },
  {
    id: 'mv-16',
    data: '07/04/2026',
    produtoSku: 'CAB-FLEX-2.5',
    produtoDescricao: 'Cabo Flexível 2,5mm² 750V',
    tipo: 'saida',
    quantidade: 10,
    origem: 'NF-e 001234',
    saldoApos: 48,
  },
  {
    id: 'mv-17',
    data: '05/04/2026',
    produtoSku: 'LED-LUM-18W',
    produtoDescricao: 'Luminária LED Plafon 18W',
    tipo: 'entrada',
    quantidade: 40,
    origem: 'Importação XML — Atacado Central',
    saldoApos: 65,
  },
  {
    id: 'mv-18',
    data: '04/04/2026',
    produtoSku: 'TEC-USB-BR01',
    produtoDescricao: 'Teclado USB ABNT2 Preto',
    tipo: 'ajuste',
    quantidade: -2,
    origem: 'Ajuste manual — quebra',
    saldoApos: 90,
  },
  {
    id: 'mv-19',
    data: '03/04/2026',
    produtoSku: 'CXO-ORG-25L',
    produtoDescricao: 'Caixa Organizadora 25L',
    tipo: 'saida',
    quantidade: 25,
    origem: 'NF-e 001228',
    saldoApos: 84,
  },
  {
    id: 'mv-20',
    data: '02/04/2026',
    produtoSku: 'DIS-20A-BIP',
    produtoDescricao: 'Disjuntor Bipolar 20A Curva C',
    tipo: 'entrada',
    quantidade: 10,
    origem: 'Importação XML — Distribuidora Sul Brasil',
    saldoApos: -2,
  },
];

const todasMovs: MovimentacaoEstoque[] = [...fixtureMovs, ...movsExtras];

const MOTIVOS = ['Inventário', 'Perda', 'Quebra', 'Doação', 'Outro'] as const;

function classificaOrigem(origem: string): OrigemFiltro {
  const lower = origem.toLowerCase();
  if (lower.includes('importa') || lower.includes('xml')) return 'xml';
  if (lower.includes('nf-e') || lower.includes('nfs-e')) return 'nfe';
  if (lower.includes('manual') || lower.includes('ajuste')) return 'manual';
  return '';
}

function parseDataBR(data: string): number {
  // "DD/MM/AAAA" → timestamp
  const parts = data.split('/').map((s) => Number.parseInt(s, 10));
  const dd = parts[0] ?? 1;
  const mm = parts[1] ?? 1;
  const yyyy = parts[2] ?? 1970;
  return new Date(yyyy, mm - 1, dd).getTime();
}

export function EstoqueClient() {
  const [rows] = useState<MovimentacaoEstoque[]>(todasMovs);
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<TipoFiltro>('');
  const [origem, setOrigem] = useState<OrigemFiltro>('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const inicioTs = dataInicio ? new Date(dataInicio).getTime() : null;
    const fimTs = dataFim ? new Date(dataFim).getTime() : null;
    return rows.filter((r) => {
      if (term) {
        const match =
          r.produtoDescricao.toLowerCase().includes(term) ||
          r.produtoSku.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (tipo && r.tipo !== tipo) return false;
      if (origem && classificaOrigem(r.origem) !== origem) return false;
      const ts = parseDataBR(r.data);
      if (inicioTs !== null && ts < inicioTs) return false;
      if (fimTs !== null && ts > fimTs) return false;
      return true;
    });
  }, [rows, search, tipo, origem, dataInicio, dataFim]);

  const clearFilters = () => {
    setSearch('');
    setTipo('');
    setOrigem('');
    setDataInicio('');
    setDataFim('');
    setPage(1);
  };

  // KPIs do período (baseados no conjunto filtrado)
  const kpis = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let ajustes = 0;
    for (const r of filtered) {
      if (r.tipo === 'entrada') entradas += r.quantidade;
      else if (r.tipo === 'saida') saidas += r.quantidade;
      else ajustes += Math.abs(r.quantidade);
    }
    const criticos = fixtureProdutos.filter((p) => p.estoque < p.estoqueMinimo).length;
    return { entradas, saidas, ajustes, criticos };
  }, [filtered]);

  // Top 5 produtos mais movimentados (pelas linhas filtradas)
  const topProdutos = useMemo(() => {
    const map = new Map<string, { descricao: string; count: number }>();
    for (const r of filtered) {
      const existing = map.get(r.produtoSku);
      if (existing) existing.count += 1;
      else map.set(r.produtoSku, { descricao: r.produtoDescricao, count: 1 });
    }
    const arr = Array.from(map.entries())
      .map(([sku, v]) => ({ sku, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const max = arr[0]?.count ?? 1;
    return arr.map((p) => ({ ...p, pct: Math.round((p.count / max) * 100) }));
  }, [filtered]);

  const columns: DataTableColumn<MovimentacaoEstoque>[] = [
    {
      key: 'data',
      header: 'Data',
      render: (m) => <span className="font-mono text-xs">{m.data}</span>,
    },
    {
      key: 'produto',
      header: 'Produto',
      render: (m) => (
        <div>
          <div className="font-medium">{m.produtoDescricao}</div>
          <div className="font-mono text-xs text-muted-foreground">{m.produtoSku}</div>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (m) => {
        if (m.tipo === 'entrada') {
          return (
            <Badge
              variant="secondary"
              className="bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
            >
              <ArrowUp className="mr-1 h-3 w-3" aria-hidden />
              Entrada
            </Badge>
          );
        }
        if (m.tipo === 'saida') {
          return (
            <Badge
              variant="secondary"
              className="bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20"
            >
              <ArrowDown className="mr-1 h-3 w-3" aria-hidden />
              Saída
            </Badge>
          );
        }
        return (
          <Badge
            variant="secondary"
            className="bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20"
          >
            <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
            Ajuste
          </Badge>
        );
      },
    },
    {
      key: 'quantidade',
      header: 'Qtd',
      align: 'right',
      render: (m) => {
        const sign =
          m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : m.quantidade < 0 ? '−' : '+';
        const qtd = Math.abs(m.quantidade);
        const cor =
          m.tipo === 'entrada'
            ? 'text-brand-green'
            : m.tipo === 'saida'
              ? 'text-brand-danger'
              : 'text-brand-blue';
        return (
          <span className={cn('font-mono font-semibold tabular-nums', cor)}>
            {sign}
            {qtd}
          </span>
        );
      },
    },
    {
      key: 'origem',
      header: 'Origem',
      render: (m) => <span className="text-xs">{m.origem}</span>,
    },
    {
      key: 'saldo',
      header: 'Saldo após',
      align: 'right',
      render: (m) => (
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            m.saldoApos < 0 && 'text-brand-danger',
          )}
        >
          {m.saldoApos}
        </span>
      ),
    },
    {
      key: 'usuario',
      header: 'Usuário',
      render: () => <span className="text-xs text-muted-foreground">Marcos Silva</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentações de Estoque</h1>
          <p className="text-muted-foreground">Histórico completo de entradas, saídas e ajustes.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ajuste manual
        </Button>
      </div>

      {/* Layout: tabela + card lateral */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <DataTable
            rows={filtered}
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
                  className={cn(
                    'h-9 rounded-md border border-input bg-background px-3 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  aria-label="Tipo"
                >
                  <option value="">Todos os tipos</option>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste</option>
                </select>
                <select
                  value={origem}
                  onChange={(e) => {
                    setOrigem(e.target.value as OrigemFiltro);
                    setPage(1);
                  }}
                  className={cn(
                    'h-9 rounded-md border border-input bg-background px-3 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  aria-label="Origem"
                >
                  <option value="">Todas as origens</option>
                  <option value="xml">XML Importado</option>
                  <option value="nfe">NF-e Emitida</option>
                  <option value="manual">Manual</option>
                </select>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Data de início"
                  className={cn(
                    'h-9 rounded-md border border-input bg-background px-2 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                />
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Data de fim"
                  className={cn(
                    'h-9 rounded-md border border-input bg-background px-2 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                />
              </>
            }
            onClearFilters={clearFilters}
            page={page}
            pageSize={10}
            onPageChange={setPage}
            totalLabelSingular="movimentação"
            totalLabelPlural="movimentações"
            emptyTitle="Nenhuma movimentação encontrada"
            emptyDescription="Ajuste os filtros ou registre um ajuste manual."
          />
        </div>

        {/* Card lateral direito — vira footer em <1024px via order-last */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <h3 className="text-sm font-semibold">Resumo do período</h3>
                <p className="text-xs text-muted-foreground">KPIs das movimentações filtradas.</p>
              </div>
              <div className="space-y-2">
                <KpiLine
                  icon={<ArrowUp className="h-4 w-4" aria-hidden />}
                  label="Total entradas"
                  value={`${kpis.entradas} un`}
                  tone="success"
                />
                <KpiLine
                  icon={<ArrowDown className="h-4 w-4" aria-hidden />}
                  label="Total saídas"
                  value={`${kpis.saidas} un`}
                  tone="danger"
                />
                <KpiLine
                  icon={<RefreshCw className="h-4 w-4" aria-hidden />}
                  label="Ajustes"
                  value={`${kpis.ajustes} un`}
                  tone="info"
                />
                <Link
                  href="/cadastros/produtos?estoqueCritico=true"
                  className="flex items-center justify-between rounded-md border border-brand-warning/30 bg-brand-warning/5 px-3 py-2 text-sm transition-colors hover:bg-brand-warning/10"
                >
                  <span className="flex items-center gap-2 text-brand-warning">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    Produtos em estoque crítico
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-brand-warning">
                    {kpis.criticos}
                  </span>
                </Link>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="h-3 w-3" aria-hidden />
                  Top 5 mais movimentados
                </h4>
                {topProdutos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem movimentações no período.</p>
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

      <AjusteManualDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
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
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [produtoSku, setProdutoSku] = useState('');
  const [tipo, setTipo] = useState<TipoMov>('ajuste');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]>('Inventário');
  const [observacao, setObservacao] = useState('');

  const reset = () => {
    setProdutoSku('');
    setTipo('ajuste');
    setQuantidade('');
    setMotivo('Inventário');
    setObservacao('');
  };

  const submit = () => {
    if (!produtoSku || !quantidade) {
      toast.error('Selecione um produto e informe a quantidade.');
      return;
    }
    toast.success('Movimentação registrada (mock)');
    reset();
    onOpenChange(false);
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
            Registre uma movimentação manual — entrada, saída ou ajuste fino de inventário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="produto" className="mb-1 block text-xs font-medium">
              Produto
            </label>
            <select
              id="produto"
              value={produtoSku}
              onChange={(e) => setProdutoSku(e.target.value)}
              className={cn(
                'h-9 w-full rounded-md border border-input bg-background px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <option value="">Selecione um produto...</option>
              {fixtureProdutos.map((p) => (
                <option key={p.id} value={p.sku}>
                  {p.descricao} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium">Tipo</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Tipo de movimentação">
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
                  {t === 'entrada' ? 'Entrada' : t === 'saida' ? 'Saída' : 'Ajuste'}
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
                step="1"
                className={cn(
                  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
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
                className={cn(
                  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="obs" className="mb-1 block text-xs font-medium">
              Observação (opcional)
            </label>
            <textarea
              id="obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              placeholder="Detalhes sobre o ajuste..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Registrar ajuste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
