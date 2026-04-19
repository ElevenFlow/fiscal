'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { type Log, logs as fixtureLogs, usuarios } from '@/lib/mock-data';
import {
  Badge,
  Button,
  Card,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from '@nexo/ui';
import { Check, ChevronDown, ChevronUp, Copy, Download, Filter, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface LogEstendido extends Log {
  resultado: 'sucesso' | 'falha';
  tipoAcao: string;
  tipoEntidade: string;
  entidadeId: string;
  userAgent: string;
  antes?: Record<string, unknown>;
  depois?: Record<string, unknown>;
}

const TIPOS_ACAO = [
  'Login',
  'Logout',
  'Emissão',
  'Cancelamento',
  'Importação XML',
  'Edição cadastro',
  'Exclusão',
  'Mudança permissão',
  'Upload certificado',
] as const;

const TIPOS_ENTIDADE = [
  'Empresa',
  'Cliente',
  'Fornecedor',
  'Produto',
  'Serviço',
  'Nota Fiscal',
  'Usuário',
  'Certificado',
  'Autenticação',
] as const;

function buildLog(base: Log, overrides: Partial<LogEstendido>): LogEstendido {
  return {
    ...base,
    resultado: 'sucesso',
    tipoAcao: 'Edição cadastro',
    tipoEntidade: 'Cliente',
    entidadeId: 'cli-xxx',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129',
    ...overrides,
  };
}

const EXTRAS: LogEstendido[] = [
  buildLog(
    {
      id: 'lg-7',
      dataHora: '18/04/2026 09:15:12',
      usuario: 'Rodrigo Silva',
      acao: 'Edição de cadastro de produto',
      entidade: 'Produto (Disjuntor 20A)',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Edição cadastro',
      tipoEntidade: 'Produto',
      entidadeId: 'p-4',
      antes: { estoqueMinimo: 10, precoVenda: 62.5 },
      depois: { estoqueMinimo: 15, precoVenda: 64.9 },
    },
  ),
  buildLog(
    {
      id: 'lg-8',
      dataHora: '18/04/2026 08:30:47',
      usuario: 'Fernanda Costa',
      acao: 'Mudança de permissão',
      entidade: 'Usuário (Lucas Martins)',
      ip: '189.45.122.8',
    },
    {
      tipoAcao: 'Mudança permissão',
      tipoEntidade: 'Usuário',
      entidadeId: 'u-5',
      antes: { perfil: 'visualizador' },
      depois: { perfil: 'empresa' },
    },
  ),
  buildLog(
    {
      id: 'lg-9',
      dataHora: '17/04/2026 22:18:03',
      usuario: 'Desconhecido',
      acao: 'Tentativa de login falhou',
      entidade: 'Autenticação',
      ip: '45.178.99.22',
    },
    {
      tipoAcao: 'Login',
      tipoEntidade: 'Autenticação',
      entidadeId: '-',
      resultado: 'falha',
    },
  ),
  buildLog(
    {
      id: 'lg-10',
      dataHora: '17/04/2026 19:02:58',
      usuario: 'Beatriz Prado',
      acao: 'Upload de certificado digital',
      entidade: 'Certificado (Oliveira Tech)',
      ip: '189.45.122.8',
    },
    {
      tipoAcao: 'Upload certificado',
      tipoEntidade: 'Certificado',
      entidadeId: 'cert-e1-2026',
      antes: {
        fingerprint: 'A1:B2:C3:D4:E5:F6',
        validade: '15/04/2026',
      },
      depois: {
        fingerprint: 'F6:E5:D4:C3:B2:A1',
        validade: '15/04/2027',
      },
    },
  ),
  buildLog(
    {
      id: 'lg-11',
      dataHora: '17/04/2026 17:22:14',
      usuario: 'Juliana Ramos',
      acao: 'Emissão de NF-e 001244',
      entidade: 'Nota Fiscal',
      ip: '177.22.33.44',
    },
    {
      tipoAcao: 'Emissão',
      tipoEntidade: 'Nota Fiscal',
      entidadeId: 'nf-2',
    },
  ),
  buildLog(
    {
      id: 'lg-12',
      dataHora: '17/04/2026 14:22:18',
      usuario: 'Rodrigo Silva',
      acao: 'Rejeição SEFAZ (código 611)',
      entidade: 'NFS-e 000181',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Emissão',
      tipoEntidade: 'Nota Fiscal',
      entidadeId: 'nf-3',
      resultado: 'falha',
    },
  ),
  buildLog(
    {
      id: 'lg-13',
      dataHora: '17/04/2026 11:04:01',
      usuario: 'Beatriz Prado',
      acao: 'Edição de cadastro de empresa',
      entidade: 'Empresa (Oliveira Tech)',
      ip: '189.45.122.8',
    },
    {
      tipoAcao: 'Edição cadastro',
      tipoEntidade: 'Empresa',
      entidadeId: 'e-1',
      antes: {
        razaoSocial: 'Oliveira Tech Soluções LTDA',
        regime: 'Simples Nacional',
        endereco: 'Rua das Palmeiras, 100',
      },
      depois: {
        razaoSocial: 'Oliveira Tech Soluções LTDA',
        regime: 'Lucro Presumido',
        endereco: 'Av. Paulista, 1578 - sala 12',
      },
    },
  ),
  buildLog(
    {
      id: 'lg-14',
      dataHora: '17/04/2026 10:33:42',
      usuario: 'Rodrigo Silva',
      acao: 'Exclusão de cliente',
      entidade: 'Cliente (Cliente Teste)',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Exclusão',
      tipoEntidade: 'Cliente',
      entidadeId: 'cl-99',
    },
  ),
  buildLog(
    {
      id: 'lg-15',
      dataHora: '17/04/2026 09:12:18',
      usuario: 'Rodrigo Silva',
      acao: 'Logout',
      entidade: 'Autenticação',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Logout',
      tipoEntidade: 'Autenticação',
      entidadeId: '-',
    },
  ),
  buildLog(
    {
      id: 'lg-16',
      dataHora: '16/04/2026 18:45:12',
      usuario: 'Marcelo Teixeira',
      acao: 'Emissão de NFS-e 000178',
      entidade: 'Nota Fiscal',
      ip: '177.22.33.44',
    },
    {
      tipoAcao: 'Emissão',
      tipoEntidade: 'Nota Fiscal',
      entidadeId: 'nf-x1',
    },
  ),
  buildLog(
    {
      id: 'lg-17',
      dataHora: '16/04/2026 15:11:08',
      usuario: 'Fernanda Costa',
      acao: 'Edição de cadastro de fornecedor',
      entidade: 'Fornecedor (Atacado Central)',
      ip: '189.45.122.8',
    },
    {
      tipoAcao: 'Edição cadastro',
      tipoEntidade: 'Fornecedor',
      entidadeId: 'f-2',
      antes: { telefone: '(11) 3000-1000' },
      depois: { telefone: '(11) 3000-2020' },
    },
  ),
  buildLog(
    {
      id: 'lg-18',
      dataHora: '16/04/2026 13:22:45',
      usuario: 'Rodrigo Silva',
      acao: 'Cancelamento de NF-e 001242',
      entidade: 'Nota Fiscal',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Cancelamento',
      tipoEntidade: 'Nota Fiscal',
      entidadeId: 'nf-5',
      antes: { status: 'autorizada' },
      depois: { status: 'cancelada', motivo: 'Valor incorreto' },
    },
  ),
  buildLog(
    {
      id: 'lg-19',
      dataHora: '16/04/2026 10:45:51',
      usuario: 'Rodrigo Silva',
      acao: 'Importação em lote de 12 XMLs',
      entidade: 'XML de Compra',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Importação XML',
      tipoEntidade: 'Nota Fiscal',
      entidadeId: 'xml-batch-042',
    },
  ),
  buildLog(
    {
      id: 'lg-20',
      dataHora: '16/04/2026 09:05:18',
      usuario: 'Juliana Ramos',
      acao: 'Emissão de NFS-e 000177',
      entidade: 'Nota Fiscal',
      ip: '177.22.33.44',
    },
    {
      tipoAcao: 'Emissão',
      tipoEntidade: 'Nota Fiscal',
      entidadeId: 'nf-x2',
    },
  ),
  buildLog(
    {
      id: 'lg-21',
      dataHora: '15/04/2026 16:30:22',
      usuario: 'Lucas Martins',
      acao: 'Edição de cadastro de serviço',
      entidade: 'Serviço (Consultoria)',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Edição cadastro',
      tipoEntidade: 'Serviço',
      entidadeId: 's-1',
      antes: { aliquotaIss: 5, precoPadrao: 2500 },
      depois: { aliquotaIss: 4.5, precoPadrao: 2600 },
    },
  ),
  buildLog(
    {
      id: 'lg-22',
      dataHora: '15/04/2026 14:12:09',
      usuario: 'Rodrigo Silva',
      acao: 'Mudança de permissão',
      entidade: 'Usuário (Juliana Ramos)',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Mudança permissão',
      tipoEntidade: 'Usuário',
      entidadeId: 'u-6',
      antes: { perfil: 'empresa', vinculo: 'Clínica Vida Integral' },
      depois: { perfil: 'empresa', vinculo: 'Clínica Vida Integral', admin_empresa: true },
    },
  ),
  buildLog(
    {
      id: 'lg-23',
      dataHora: '15/04/2026 11:05:09',
      usuario: 'Marcelo Teixeira',
      acao: 'Cancelamento de NF-e 001242',
      entidade: 'Nota Fiscal',
      ip: '177.22.33.44',
    },
    {
      tipoAcao: 'Cancelamento',
      tipoEntidade: 'Nota Fiscal',
      entidadeId: 'nf-5',
    },
  ),
  buildLog(
    {
      id: 'lg-24',
      dataHora: '14/04/2026 16:08:33',
      usuario: 'Beatriz Prado',
      acao: 'Login',
      entidade: 'Autenticação',
      ip: '189.45.122.8',
    },
    {
      tipoAcao: 'Login',
      tipoEntidade: 'Autenticação',
      entidadeId: '-',
    },
  ),
  buildLog(
    {
      id: 'lg-25',
      dataHora: '14/04/2026 09:22:11',
      usuario: 'Rodrigo Silva',
      acao: 'Edição de cadastro de empresa',
      entidade: 'Empresa (Oliveira Tech)',
      ip: '200.171.88.12',
    },
    {
      tipoAcao: 'Edição cadastro',
      tipoEntidade: 'Empresa',
      entidadeId: 'e-1',
      antes: { inscricaoEstadual: '123.456.789.000' },
      depois: { inscricaoEstadual: '987.654.321.000' },
    },
  ),
  buildLog(
    {
      id: 'lg-26',
      dataHora: '13/04/2026 15:40:02',
      usuario: 'Fernanda Costa',
      acao: 'Login',
      entidade: 'Autenticação',
      ip: '189.45.122.8',
    },
    { tipoAcao: 'Login', tipoEntidade: 'Autenticação', entidadeId: '-' },
  ),
];

const ALL_LOGS: LogEstendido[] = [
  ...fixtureLogs.map((l) => {
    const tipoAcao: LogEstendido['tipoAcao'] = l.acao.startsWith('Login')
      ? 'Login'
      : l.acao.startsWith('Emissão')
        ? 'Emissão'
        : l.acao.startsWith('Cancelamento')
          ? 'Cancelamento'
          : l.acao.startsWith('Importação')
            ? 'Importação XML'
            : l.acao.startsWith('Rejeição')
              ? 'Emissão'
              : 'Edição cadastro';
    const resultado: LogEstendido['resultado'] = l.acao.startsWith('Rejeição')
      ? 'falha'
      : 'sucesso';
    return {
      ...l,
      resultado,
      tipoAcao,
      tipoEntidade: l.entidade.includes('Nota')
        ? 'Nota Fiscal'
        : l.entidade.includes('Cliente')
          ? 'Cliente'
          : l.entidade.includes('XML')
            ? 'Nota Fiscal'
            : 'Autenticação',
      entidadeId: l.id.replace('lg-', 'ent-'),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129',
    };
  }),
  ...EXTRAS,
];

export function AuditoriaClient() {
  const [search, setSearch] = useState('');
  const [tipoAcaoSet, setTipoAcaoSet] = useState<Set<string>>(new Set());
  const [tipoEntidadeSet, setTipoEntidadeSet] = useState<Set<string>>(new Set());
  const [usuarioFiltro, setUsuarioFiltro] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resultado, setResultado] = useState<'todos' | 'sucesso' | 'falha'>('todos');
  const [advanced, setAdvanced] = useState(false);
  const [ipRange, setIpRange] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LogEstendido | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ALL_LOGS.filter((l) => {
      if (term) {
        const match =
          l.usuario.toLowerCase().includes(term) ||
          l.entidade.toLowerCase().includes(term) ||
          (l.ip?.includes(term) ?? false) ||
          l.acao.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (tipoAcaoSet.size > 0 && !tipoAcaoSet.has(l.tipoAcao)) return false;
      if (tipoEntidadeSet.size > 0 && !tipoEntidadeSet.has(l.tipoEntidade)) return false;
      if (usuarioFiltro && l.usuario !== usuarioFiltro) return false;
      if (resultado !== 'todos' && l.resultado !== resultado) return false;
      if (advanced && ipRange && !(l.ip ?? '').startsWith(ipRange)) return false;
      return true;
    });
  }, [search, tipoAcaoSet, tipoEntidadeSet, usuarioFiltro, resultado, advanced, ipRange]);

  const clearFilters = () => {
    setSearch('');
    setTipoAcaoSet(new Set());
    setTipoEntidadeSet(new Set());
    setUsuarioFiltro('');
    setDateFrom('');
    setDateTo('');
    setResultado('todos');
    setIpRange('');
    setPage(1);
  };

  const exportCsv = () => {
    toast.success(`Exportação de ${filtered.length} logs iniciada (mock)`);
  };

  const columns: DataTableColumn<LogEstendido>[] = [
    {
      key: 'dataHora',
      header: 'Data / Hora',
      render: (l) => <span className="font-mono text-xs">{l.dataHora}</span>,
    },
    {
      key: 'usuario',
      header: 'Usuário',
      render: (l) => <span className="font-medium">{l.usuario}</span>,
    },
    {
      key: 'ip',
      header: 'IP',
      render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.ip ?? '—'}</span>,
    },
    {
      key: 'acao',
      header: 'Ação',
      render: (l) => l.acao,
    },
    {
      key: 'entidade',
      header: 'Entidade',
      render: (l) => (
        <div>
          <div className="text-sm">{l.entidade}</div>
          <div className="font-mono text-xs text-muted-foreground">{l.entidadeId}</div>
        </div>
      ),
    },
    {
      key: 'resultado',
      header: 'Resultado',
      align: 'center',
      render: (l) => (
        <Badge
          variant={l.resultado === 'sucesso' ? 'success' : 'destructive'}
          className="font-semibold"
        >
          {l.resultado === 'sucesso' ? '✓ Sucesso' : '✗ Falha'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logs e Auditoria</h1>
          <p className="text-muted-foreground">
            Trilha imutável de todas as ações críticas · retenção de 5 anos
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Barra de filtros */}
      <Card className="sticky top-0 z-10 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por usuário, entidade ou IP..."
              className="h-9 flex-1 min-w-[240px] rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <select
              value={usuarioFiltro}
              onChange={(e) => {
                setUsuarioFiltro(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Usuário"
            >
              <option value="">Todos os usuários</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.nome}>
                  {u.nome}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Data de início"
            />
            <span className="text-sm text-muted-foreground">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Data de fim"
            />
            <select
              value={resultado}
              onChange={(e) => setResultado(e.target.value as 'todos' | 'sucesso' | 'falha')}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Resultado"
            >
              <option value="todos">Todos</option>
              <option value="sucesso">Sucesso</option>
              <option value="falha">Falha</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAdvanced((a) => !a)}
              className="gap-1"
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros avançados
              {advanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ação:
            </span>
            {TIPOS_ACAO.map((t) => {
              const selected = tipoAcaoSet.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipoAcaoSet((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    });
                    setPage(1);
                  }}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                    selected
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-input bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Entidade:
            </span>
            {TIPOS_ENTIDADE.map((t) => {
              const selected = tipoEntidadeSet.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipoEntidadeSet((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    });
                    setPage(1);
                  }}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                    selected
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-input bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {advanced ? (
            <>
              <Separator />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  IP começa com:
                </span>
                <input
                  type="text"
                  value={ipRange}
                  onChange={(e) => {
                    setIpRange(e.target.value);
                    setPage(1);
                  }}
                  placeholder="200.171."
                  className="h-9 w-40 rounded-md border border-input bg-background px-3 font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  Session ID: <span className="font-mono">sess_8f3a2b1c</span>
                </span>
              </div>
            </>
          ) : null}
        </div>
      </Card>

      {/* Tabela */}
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(l) => l.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar nos logs..."
        onClearFilters={clearFilters}
        actions={(row) => (
          <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
            Ver detalhes
          </Button>
        )}
        page={page}
        pageSize={12}
        onPageChange={setPage}
        totalLabelSingular="log"
        totalLabelPlural="logs"
        emptyTitle="Nenhum log encontrado"
        emptyDescription="Ajuste os filtros ou limpe a busca."
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Mostrando 1-{Math.min(12, filtered.length)} de {filtered.length} logs (de 1.247 no total)
        </span>
        <span>Retenção até 17/04/2031</span>
      </div>

      {/* Sheet de detalhes */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>Detalhes do log #{selected.id}</SheetTitle>
                <SheetDescription>
                  Registro imutável · não pode ser editado nem excluído.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Data / Hora
                    </dt>
                    <dd className="mt-0.5 font-mono">{selected.dataHora}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Usuário
                    </dt>
                    <dd className="mt-0.5 font-medium">{selected.usuario}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      IP
                    </dt>
                    <dd className="mt-0.5 font-mono">{selected.ip ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Ação
                    </dt>
                    <dd className="mt-0.5">{selected.acao}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Resultado
                    </dt>
                    <dd className="mt-0.5">
                      <Badge variant={selected.resultado === 'sucesso' ? 'success' : 'destructive'}>
                        {selected.resultado === 'sucesso' ? (
                          <>
                            <Check className="mr-1 h-3 w-3" /> Sucesso
                          </>
                        ) : (
                          <>
                            <X className="mr-1 h-3 w-3" /> Falha
                          </>
                        )}
                      </Badge>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Entidade
                    </dt>
                    <dd className="mt-0.5">
                      {selected.entidade}{' '}
                      <span className="font-mono text-xs text-muted-foreground">
                        (ID {selected.entidadeId})
                      </span>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      User-agent
                    </dt>
                    <dd className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                      {selected.userAgent}
                    </dd>
                  </div>
                </dl>

                <Separator />

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Antes → Depois</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const payload = JSON.stringify(
                          { antes: selected.antes ?? null, depois: selected.depois ?? null },
                          null,
                          2,
                        );
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(payload).catch(() => undefined);
                        }
                        toast.success('JSON copiado');
                      }}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copiar JSON
                    </Button>
                  </div>
                  {selected.antes || selected.depois ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase text-brand-danger">
                          Antes
                        </div>
                        <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                          {JSON.stringify(selected.antes ?? null, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase text-brand-green">
                          Depois
                        </div>
                        <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                          {JSON.stringify(selected.depois ?? null, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                      Ação sem diff (login/logout/importação).
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
