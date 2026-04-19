'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { FormField } from '@/components/forms/form-field';
import { numberToBRL } from '@/components/forms/masks';
import {
  type NotaFiscal,
  type NotaStatus,
  type NotaTipo,
  notasFiscais as fixtureNotas,
} from '@/lib/mock-data';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Money,
  Separator,
  StatusPill,
  cn,
} from '@nexo/ui';
import {
  Archive,
  Copy,
  Download,
  Eye,
  FileCode,
  FileDown,
  FileText,
  Filter,
  Mail,
  MoreHorizontal,
  Send,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type TabValue = 'todos' | 'NFS-e' | 'NF-e' | 'NF-e Dev';

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'NFS-e', label: 'NFS-e' },
  { value: 'NF-e', label: 'NF-e' },
  { value: 'NF-e Dev', label: 'Devoluções' },
];

const STATUS_OPTIONS: Array<{ value: NotaStatus; label: string }> = [
  { value: 'autorizada', label: 'Autorizada' },
  { value: 'rejeitada', label: 'Rejeitada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'processando', label: 'Processando' },
];

// Expande fixture para ter volume suficiente pra paginação/filtros
const NOTAS_EXTRAS: NotaFiscal[] = [
  {
    id: 'nf-8',
    tipo: 'NF-e',
    numero: '001245',
    serie: '1',
    data: '18/04/2026',
    destinatarioNome: 'Mariana Souza Estética',
    valor: 1230.0,
    status: 'processando',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 4510 2233 4455',
    empresaId: 'e-1',
  },
  {
    id: 'nf-9',
    tipo: 'NFS-e',
    numero: '000179',
    serie: 'A',
    data: '13/04/2026',
    destinatarioNome: 'Ana Paula Ribeiro',
    valor: 6800.0,
    status: 'autorizada',
    empresaId: 'e-1',
  },
  {
    id: 'nf-10',
    tipo: 'NF-e',
    numero: '001240',
    serie: '1',
    data: '12/04/2026',
    destinatarioNome: 'Supermercado Bom Preço LTDA',
    valor: 5420.9,
    status: 'autorizada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 4010 1122 3344',
    empresaId: 'e-1',
  },
  {
    id: 'nf-11',
    tipo: 'NF-e Dev',
    numero: '000034',
    serie: '1',
    data: '11/04/2026',
    destinatarioNome: 'Atacado Central Paulista S/A',
    valor: 780.0,
    status: 'autorizada',
    chaveAcesso: '3526 0488 9990 0000 0121 5500 1000 0000 3410 5566 7788',
    empresaId: 'e-1',
  },
  {
    id: 'nf-12',
    tipo: 'NF-e',
    numero: '001239',
    serie: '1',
    data: '10/04/2026',
    destinatarioNome: 'Carlos Ferreira',
    valor: 189.9,
    status: 'autorizada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 3910 8822 1100',
    empresaId: 'e-1',
  },
  {
    id: 'nf-13',
    tipo: 'NFS-e',
    numero: '000178',
    serie: 'A',
    data: '09/04/2026',
    destinatarioNome: 'Construtora Horizonte LTDA',
    valor: 4500.0,
    status: 'autorizada',
    empresaId: 'e-1',
  },
  {
    id: 'nf-14',
    tipo: 'NFS-e',
    numero: '000177',
    serie: 'A',
    data: '08/04/2026',
    destinatarioNome: 'Mariana Souza Estética',
    valor: 980.0,
    status: 'cancelada',
    empresaId: 'e-1',
  },
  {
    id: 'nf-15',
    tipo: 'NF-e',
    numero: '001238',
    serie: '1',
    data: '07/04/2026',
    destinatarioNome: 'Supermercado Bom Preço LTDA',
    valor: 2340.0,
    status: 'rejeitada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 3810 4433 2211',
    empresaId: 'e-1',
  },
  {
    id: 'nf-16',
    tipo: 'NF-e',
    numero: '001237',
    serie: '1',
    data: '06/04/2026',
    destinatarioNome: 'Ana Paula Ribeiro',
    valor: 159.9,
    status: 'autorizada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 3710 6655 7788',
    empresaId: 'e-1',
  },
  {
    id: 'nf-17',
    tipo: 'NF-e Dev',
    numero: '000033',
    serie: '1',
    data: '05/04/2026',
    destinatarioNome: 'Distribuidora Sul Brasil LTDA',
    valor: 2100.0,
    status: 'autorizada',
    chaveAcesso: '3526 0377 8899 9000 0110 5500 1000 0000 3310 9988 7722',
    empresaId: 'e-1',
  },
  {
    id: 'nf-18',
    tipo: 'NFS-e',
    numero: '000176',
    serie: 'A',
    data: '04/04/2026',
    destinatarioNome: 'Construtora Horizonte LTDA',
    valor: 12800.0,
    status: 'autorizada',
    empresaId: 'e-1',
  },
  {
    id: 'nf-19',
    tipo: 'NF-e',
    numero: '001236',
    serie: '1',
    data: '03/04/2026',
    destinatarioNome: 'Carlos Ferreira',
    valor: 450.5,
    status: 'pendente',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 3610 1199 2288',
    empresaId: 'e-1',
  },
];

const TODAS_NOTAS: NotaFiscal[] = [...fixtureNotas, ...NOTAS_EXTRAS];

function parseDataBR(data: string): number {
  const parts = data.split('/').map((s) => Number.parseInt(s, 10));
  const dd = parts[0] ?? 1;
  const mm = parts[1] ?? 1;
  const yyyy = parts[2] ?? 1970;
  return new Date(yyyy, mm - 1, dd).getTime();
}

function diasAtras(data: string): number {
  const ts = parseDataBR(data);
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

export function DocumentosClient() {
  const [rows] = useState<NotaFiscal[]>(TODAS_NOTAS);
  const [tab, setTab] = useState<TabValue>('todos');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filtros avançados
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusSel, setStatusSel] = useState<NotaStatus[]>([]);
  const [destinatarioFiltro, setDestinatarioFiltro] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');

  // Seleção em lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Dialog visualizar
  const [visualizar, setVisualizar] = useState<NotaFiscal | null>(null);
  const [visualizarTab, setVisualizarTab] = useState<'dados' | 'xml'>('dados');

  // Dialog enviar e-mail
  const [enviarEmail, setEnviarEmail] = useState<NotaFiscal | null>(null);
  const [emailDestino, setEmailDestino] = useState('');

  // Dialog carta correção
  const [cartaOpen, setCartaOpen] = useState<NotaFiscal | null>(null);
  const [cartaTexto, setCartaTexto] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const ini = dataInicio ? new Date(dataInicio).getTime() : null;
    const fim = dataFim ? new Date(dataFim).getTime() : null;
    const vMin = valorMin ? Number(valorMin.replace(',', '.')) : null;
    const vMax = valorMax ? Number(valorMax.replace(',', '.')) : null;
    const destLower = destinatarioFiltro.trim().toLowerCase();

    return rows.filter((n) => {
      if (tab !== 'todos' && n.tipo !== tab) return false;
      if (term) {
        const matchNum = n.numero.includes(term);
        const matchChave =
          n.chaveAcesso?.replace(/\s/g, '').toLowerCase().includes(term.replace(/\s/g, '')) ??
          false;
        if (!matchNum && !matchChave) return false;
      }
      if (statusSel.length > 0 && !statusSel.includes(n.status)) return false;
      if (destLower && !n.destinatarioNome.toLowerCase().includes(destLower)) return false;
      const ts = parseDataBR(n.data);
      if (ini !== null && ts < ini) return false;
      if (fim !== null && ts > fim) return false;
      if (vMin !== null && n.valor < vMin) return false;
      if (vMax !== null && n.valor > vMax) return false;
      return true;
    });
  }, [rows, tab, search, dataInicio, dataFim, statusSel, destinatarioFiltro, valorMin, valorMax]);

  const totalValor = useMemo(() => filtered.reduce((acc, n) => acc + n.valor, 0), [filtered]);

  const clearFilters = () => {
    setSearch('');
    setDataInicio('');
    setDataFim('');
    setStatusSel([]);
    setDestinatarioFiltro('');
    setValorMin('');
    setValorMax('');
    setPage(1);
  };

  const toggleSelecao = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelecaoTodos = (checked: boolean) => {
    if (checked) setSelecionados(new Set(filtered.map((n) => n.id)));
    else setSelecionados(new Set());
  };

  const columns: DataTableColumn<NotaFiscal>[] = [
    {
      key: 'check',
      header: '',
      className: 'w-10',
      render: (n) => (
        <input
          type="checkbox"
          checked={selecionados.has(n.id)}
          onChange={() => toggleSelecao(n.id)}
          aria-label={`Selecionar ${n.numero}`}
        />
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (n) => <TipoBadge tipo={n.tipo} />,
    },
    {
      key: 'numero',
      header: 'Número / Série',
      render: (n) => (
        <div className="font-mono text-xs">
          <div className="font-semibold">{n.numero}</div>
          <div className="text-muted-foreground">Série {n.serie}</div>
        </div>
      ),
    },
    {
      key: 'data',
      header: 'Data',
      render: (n) => <span className="font-mono text-xs">{n.data}</span>,
    },
    {
      key: 'destinatario',
      header: 'Cliente / Fornecedor',
      render: (n) => <span className="text-sm">{n.destinatarioNome}</span>,
    },
    {
      key: 'valor',
      header: 'Valor',
      align: 'right',
      render: (n) => <Money value={n.valor} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (n) => <StatusPill status={n.status} />,
    },
  ];

  const podeCancelar = (n: NotaFiscal) => {
    if (n.status !== 'autorizada') return false;
    // NFS-e tem prazo diferente, mas simplificamos pro mock: 24h = só notas de hoje ou ontem
    return diasAtras(n.data) <= 1;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentos fiscais</h1>
          <p className="text-muted-foreground">
            <strong>{filtered.length}</strong> documento{filtered.length === 1 ? '' : 's'} · Total:{' '}
            <Money value={totalValor} className="font-semibold text-foreground" /> no período
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" aria-hidden />
              Exportar seleção
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => toast.success('CSV gerado (mock)')}>
              Exportar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.success('ZIP gerado (mock)')}>
              Baixar ZIP de XMLs
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.success('Download individual (mock)')}>
              Download individual
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1">
        {TABS.map((t) => {
          const active = t.value === tab;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => {
                setTab(t.value);
                setPage(1);
              }}
              className={cn(
                'min-w-fit rounded-md px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filtros avançados (colapsável) */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex items-center gap-2 text-sm font-medium"
            aria-expanded={filtersOpen}
          >
            <Filter className="h-4 w-4" aria-hidden />
            Filtros avançados
            <Badge variant="secondary" className="ml-1">
              {[
                dataInicio && 'período',
                statusSel.length > 0 && 'status',
                destinatarioFiltro && 'cliente',
                (valorMin || valorMax) && 'valor',
              ].filter(Boolean).length || '—'}
            </Badge>
          </button>
          {filtersOpen ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" aria-hidden />
              Limpar
            </Button>
          ) : null}
        </div>
        {filtersOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <FormField label="Data início" htmlFor="f-dt-i">
              <Input
                id="f-dt-i"
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPage(1);
                }}
              />
            </FormField>
            <FormField label="Data fim" htmlFor="f-dt-f">
              <Input
                id="f-dt-f"
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPage(1);
                }}
              />
            </FormField>
            <FormField label="Cliente/Fornecedor" htmlFor="f-dest">
              <Input
                id="f-dest"
                value={destinatarioFiltro}
                onChange={(e) => {
                  setDestinatarioFiltro(e.target.value);
                  setPage(1);
                }}
                placeholder="Nome..."
              />
            </FormField>
            <FormField label="Valor mínimo (R$)" htmlFor="f-vmin">
              <Input
                id="f-vmin"
                type="number"
                step="0.01"
                value={valorMin}
                onChange={(e) => {
                  setValorMin(e.target.value);
                  setPage(1);
                }}
              />
            </FormField>
            <FormField label="Valor máximo (R$)" htmlFor="f-vmax">
              <Input
                id="f-vmax"
                type="number"
                step="0.01"
                value={valorMax}
                onChange={(e) => {
                  setValorMax(e.target.value);
                  setPage(1);
                }}
              />
            </FormField>
            <div>
              <span className="mb-1 block text-sm font-medium">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => {
                  const active = statusSel.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        setStatusSel((prev) =>
                          prev.includes(s.value)
                            ? prev.filter((v) => v !== s.value)
                            : [...prev, s.value],
                        );
                        setPage(1);
                      }}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs transition-colors',
                        active
                          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                          : 'border-input hover:bg-muted/40',
                      )}
                      aria-pressed={active}
                    >
                      <StatusPill status={s.value} className="border-0 bg-transparent p-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Barra de ações em lote */}
      {selecionados.size > 0 ? (
        <Card className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
          <span className="text-sm">
            <strong>{selecionados.size}</strong> selecionado{selecionados.size === 1 ? '' : 's'}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success('XMLs baixados (mock)')}
            >
              <FileCode className="mr-2 h-4 w-4" aria-hidden />
              Baixar XML em lote
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success('PDFs baixados (mock)')}
            >
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              Baixar PDF em lote
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.success('ZIP gerado (mock)')}>
              <Archive className="mr-2 h-4 w-4" aria-hidden />
              Baixar ZIP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success('CSV exportado (mock)')}
            >
              <FileDown className="mr-2 h-4 w-4" aria-hidden />
              Exportar CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelecionados(new Set())}
              aria-label="Limpar seleção"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Tabela + select-all header */}
      <div className="space-y-2">
        {filtered.length > 0 ? (
          <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={selecionados.size === filtered.length && filtered.length > 0}
              onChange={(e) => toggleSelecaoTodos(e.target.checked)}
            />
            Selecionar todos os {filtered.length} documentos da página atual
          </label>
        ) : null}

        <DataTable
          rows={filtered}
          columns={columns}
          getRowId={(n) => n.id}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Buscar por número ou chave de acesso..."
          page={page}
          pageSize={10}
          onPageChange={setPage}
          totalLabelSingular="documento"
          totalLabelPlural="documentos"
          emptyTitle="Nenhum documento encontrado"
          emptyDescription="Tente ajustar os filtros ou a busca."
          onClearFilters={clearFilters}
          actions={(n) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Ações">
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={() => {
                    setVisualizar(n);
                    setVisualizarTab('dados');
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" aria-hidden />
                  Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast.success('PDF baixado (mock)')}>
                  <FileText className="mr-2 h-4 w-4" aria-hidden />
                  Baixar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toast.success('XML baixado (mock)')}>
                  <FileCode className="mr-2 h-4 w-4" aria-hidden />
                  Baixar XML
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setEnviarEmail(n);
                    setEmailDestino('');
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" aria-hidden />
                  Enviar por e-mail
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {podeCancelar(n) ? (
                  <DropdownMenuItem
                    className="text-brand-danger focus:text-brand-danger"
                    onSelect={() => toast.success(`Nota ${n.numero} cancelada (mock)`)}
                  >
                    Cancelar
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>Cancelar (fora do prazo)</DropdownMenuItem>
                )}
                {n.tipo === 'NF-e' ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      setCartaOpen(n);
                      setCartaTexto('');
                    }}
                  >
                    Carta de correção
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </div>

      {/* Dialog visualizar */}
      <Dialog
        open={!!visualizar}
        onOpenChange={(v) => {
          if (!v) setVisualizar(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {visualizar?.tipo} {visualizar?.numero}
            </DialogTitle>
            <DialogDescription>
              {visualizar?.destinatarioNome} · {visualizar?.data}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div role="tablist" className="flex gap-1 rounded-md border bg-muted/40 p-1">
              {(['dados', 'xml'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={visualizarTab === t}
                  onClick={() => setVisualizarTab(t)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    visualizarTab === t
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'dados' ? 'Dados' : 'XML'}
                </button>
              ))}
            </div>

            {visualizarTab === 'dados' ? (
              <div className="rounded-md border bg-card p-5 font-mono text-xs">
                <div className="mb-3 border-b pb-3 text-center">
                  <div className="font-bold">
                    {visualizar?.tipo === 'NFS-e'
                      ? 'DANFSE — DOCUMENTO AUXILIAR DA NFS-E'
                      : visualizar?.tipo === 'NF-e Dev'
                        ? 'DANFE — NF-E DE DEVOLUÇÃO (MOD. 55)'
                        : 'DANFE — DOCUMENTO AUXILIAR DA NF-E (MOD. 55)'}
                  </div>
                  <div>
                    Nº {visualizar?.numero} · Série {visualizar?.serie} · {visualizar?.data}
                  </div>
                </div>
                {visualizar?.chaveAcesso ? (
                  <div className="mb-3">
                    <strong>Chave de acesso:</strong>
                    <div className="mt-1 break-all">{visualizar.chaveAcesso}</div>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <div>
                    <strong>Destinatário:</strong> {visualizar?.destinatarioNome}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <StatusPill
                      status={(visualizar?.status ?? 'pendente') as NotaStatus}
                      className="ml-1"
                    />
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="text-sm font-bold">
                  VALOR TOTAL: R$ {numberToBRL(visualizar?.valor ?? 0)}
                </div>
              </div>
            ) : (
              <pre className="max-h-[400px] overflow-auto rounded-md border bg-muted/30 p-3 text-[10px]">
                {`<?xml version="1.0" encoding="UTF-8"?>
<${visualizar?.tipo === 'NFS-e' ? 'NFSe' : 'nfeProc'} xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${(visualizar?.chaveAcesso ?? '').replace(/\s/g, '')}">
    <ide>
      <nNF>${visualizar?.numero ?? ''}</nNF>
      <serie>${visualizar?.serie ?? ''}</serie>
      <dhEmi>${visualizar?.data ?? ''}T10:00:00-03:00</dhEmi>
    </ide>
    <dest>
      <xNome>${visualizar?.destinatarioNome ?? ''}</xNome>
    </dest>
    <total>
      <vNF>${(visualizar?.valor ?? 0).toFixed(2)}</vNF>
    </total>
  </infNFe>
  <protNFe>
    <infProt>
      <cStat>${visualizar?.status === 'autorizada' ? '100' : '999'}</cStat>
      <xMotivo>${visualizar?.status === 'autorizada' ? 'Autorizado o uso' : (visualizar?.status ?? '').toUpperCase()}</xMotivo>
    </infProt>
  </protNFe>
</${visualizar?.tipo === 'NFS-e' ? 'NFSe' : 'nfeProc'}>`}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVisualizar(null)}>
              Fechar
            </Button>
            <Button onClick={() => toast.success('Documento baixado (mock)')}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog enviar e-mail */}
      <Dialog
        open={!!enviarEmail}
        onOpenChange={(v) => {
          if (!v) setEnviarEmail(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar {enviarEmail?.tipo} por e-mail</DialogTitle>
            <DialogDescription>
              Nota {enviarEmail?.numero} · {enviarEmail?.destinatarioNome}
            </DialogDescription>
          </DialogHeader>
          <FormField label="E-mail do destinatário" htmlFor="send-email" required>
            <Input
              id="send-email"
              type="email"
              value={emailDestino}
              onChange={(e) => setEmailDestino(e.target.value)}
              placeholder="destinatario@empresa.com.br"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnviarEmail(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!emailDestino) {
                  toast.error('Informe o e-mail.');
                  return;
                }
                toast.success(`E-mail enviado para ${emailDestino} (mock)`);
                setEnviarEmail(null);
              }}
            >
              <Send className="mr-2 h-4 w-4" aria-hidden />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog carta correção */}
      <Dialog
        open={!!cartaOpen}
        onOpenChange={(v) => {
          if (!v) setCartaOpen(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Carta de correção — NF-e {cartaOpen?.numero}</DialogTitle>
            <DialogDescription>
              Máx. 20 eventos por NF-e. Prazo de 720h após autorização. Não pode alterar valor, base
              de cálculo ou destinatário.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Texto da correção" htmlFor="cce-texto" required>
            <textarea
              id="cce-texto"
              value={cartaTexto}
              onChange={(e) => setCartaTexto(e.target.value)}
              rows={5}
              maxLength={1000}
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              placeholder="Descreva a correção..."
            />
          </FormField>
          <div className="text-right text-xs text-muted-foreground">
            {cartaTexto.length}/1000 caracteres
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartaOpen(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (cartaTexto.trim().length < 15) {
                  toast.error('Descreva a correção com no mínimo 15 caracteres.');
                  return;
                }
                toast.success('Carta de correção registrada (mock)');
                setCartaOpen(null);
              }}
            >
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Emitir CC-e
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: NotaTipo }) {
  if (tipo === 'NFS-e') {
    return (
      <Badge variant="secondary" className="bg-brand-blue/10 text-brand-blue">
        NFS-e
      </Badge>
    );
  }
  if (tipo === 'NF-e') {
    return (
      <Badge variant="secondary" className="bg-brand-green/10 text-brand-green">
        NF-e
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-brand-warning/10 text-brand-warning">
      Devolução
    </Badge>
  );
}
