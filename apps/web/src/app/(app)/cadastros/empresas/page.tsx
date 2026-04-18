'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { UfSelect } from '@/components/forms/uf-select';
import { type Empresa, empresas as empresasFixture } from '@/lib/mock-data';
import { Button, StatusPill, cn } from '@nexo/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI'] as const;
const STATUS_OPTIONS: Array<{ value: Empresa['status']; label: string }> = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'suspensa', label: 'Suspensa' },
];

const statusToPill: Record<Empresa['status'], 'autorizada' | 'pendente' | 'cancelada'> = {
  ativa: 'autorizada',
  pendente: 'pendente',
  suspensa: 'cancelada',
};

export default function EmpresasListPage() {
  const [rows, setRows] = useState(empresasFixture);
  const [search, setSearch] = useState('');
  const [regime, setRegime] = useState('');
  const [uf, setUf] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (term) {
        const match =
          e.razaoSocial.toLowerCase().includes(term) ||
          e.nomeFantasia.toLowerCase().includes(term) ||
          e.cnpj.includes(term);
        if (!match) return false;
      }
      if (regime && e.regime !== regime) return false;
      if (uf && e.uf !== uf) return false;
      if (status && e.status !== status) return false;
      return true;
    });
  }, [rows, search, regime, uf, status]);

  const clearFilters = () => {
    setSearch('');
    setRegime('');
    setUf('');
    setStatus('');
    setPage(1);
  };

  const handleDelete = (id: string, nome: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Empresa "${nome}" removida (mock)`);
  };

  const columns: DataTableColumn<Empresa>[] = [
    {
      key: 'razao',
      header: 'Razão social',
      render: (e) => (
        <div>
          <div className="font-medium">{e.razaoSocial}</div>
          <div className="text-xs text-muted-foreground">{e.nomeFantasia}</div>
        </div>
      ),
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      render: (e) => <span className="font-mono text-xs">{e.cnpj}</span>,
    },
    { key: 'regime', header: 'Regime', render: (e) => e.regime },
    {
      key: 'local',
      header: 'Cidade / UF',
      render: (e) => (
        <span>
          {e.cidade}/<span className="font-semibold">{e.uf}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusPill status={statusToPill[e.status]} />,
    },
    {
      key: 'ultimoAcesso',
      header: 'Último acesso',
      className: 'text-xs text-muted-foreground',
      render: (e) => e.ultimoAcesso,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'empresa' : 'empresas'} na sua carteira.
          </p>
        </div>
        <Button asChild>
          <Link href="/cadastros/empresas/novo">
            <Plus className="mr-2 h-4 w-4" />
            Nova empresa
          </Link>
        </Button>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(e) => e.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por razão, fantasia ou CNPJ..."
        filters={
          <>
            <select
              value={regime}
              onChange={(e) => {
                setRegime(e.target.value);
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-md border border-input bg-background px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Regime"
            >
              <option value="">Todos os regimes</option>
              {REGIMES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <UfSelect
              className="h-9 w-24"
              value={uf}
              onChange={(v) => {
                setUf(v);
                setPage(1);
              }}
              placeholder="UF"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-md border border-input bg-background px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Status"
            >
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        }
        onClearFilters={clearFilters}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/empresas/${row.id}`}
            onDelete={() => handleDelete(row.id, row.razaoSocial)}
            deleteTitle="Remover empresa"
            deleteDescription={`Remover "${row.razaoSocial}" da base? Essa ação é simulada no modo protótipo.`}
            extra={[
              {
                label: 'Abrir certificado',
                onClick: () => toast.info('Abrir certificado (mock)'),
              },
              {
                label: 'Suspender acesso',
                onClick: () => toast.info('Suspensão registrada (mock)'),
              },
            ]}
          />
        )}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        totalLabelSingular="empresa"
        totalLabelPlural="empresas"
        emptyTitle="Nenhuma empresa encontrada"
        emptyDescription="Nenhuma empresa atende aos filtros aplicados. Ajuste a busca ou crie uma nova."
      />
    </div>
  );
}
