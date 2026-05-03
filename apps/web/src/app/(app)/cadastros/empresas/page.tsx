'use client';

/**
 * Listagem de Empresas — Plan 02-07 Task 3.
 */

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { UfSelect } from '@/components/forms/uf-select';
import { Button, StatusPill, cn } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

const REGIMES = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'mei', label: 'MEI' },
] as const;

interface EmpresaListItem {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: string;
  endereco: { cidade?: string; uf?: string } | null;
  contabilidades?: Array<{
    ativo: boolean;
    contabilidade: {
      id: string;
      nome: string;
      cnpj: string;
    };
  }>;
  ativo: boolean;
  createdAt: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export default function EmpresasListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [regime, setRegime] = useState('');
  const [uf, setUf] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isFetching, isLoading, refetch } = useQuery<PageResult<EmpresaListItem>>({
    queryKey: ['empresas', { page, pageSize, search, regime, uf }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
        ...(regime ? { regimeTributario: regime } : {}),
        ...(uf ? { uf } : {}),
      });
      const res = await fetch(`/api/empresas?${params}`);
      if (!res.ok) throw new Error('Falha ao carregar empresas');
      return (await res.json()) as PageResult<EmpresaListItem>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/empresas/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      qc.invalidateQueries({ queryKey: ['empresas-minhas'] });
      toast.success('Empresa desativada');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: DataTableColumn<EmpresaListItem>[] = [
    {
      key: 'razao',
      header: 'Razão social',
      render: (e) => (
        <div>
          <div className="font-medium">{e.razaoSocial}</div>
          {e.nomeFantasia ? (
            <div className="text-xs text-muted-foreground">{e.nomeFantasia}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      render: (e) => <span className="font-mono text-xs">{e.cnpj}</span>,
    },
    {
      key: 'regime',
      header: 'Regime',
      render: (e) =>
        REGIMES.find((r) => r.value === e.regimeTributario)?.label ?? e.regimeTributario,
    },
    {
      key: 'local',
      header: 'Cidade / UF',
      render: (e) => {
        const cidade = e.endereco?.cidade ?? '—';
        const ufVal = e.endereco?.uf ?? '—';
        return (
          <span>
            {cidade}/<span className="font-semibold">{ufVal}</span>
          </span>
        );
      },
    },
    {
      key: 'contabilidade',
      header: 'Contabilidade',
      render: (e) => {
        const vinculosAtivos = e.contabilidades?.filter((vinculo) => vinculo.ativo) ?? [];
        if (vinculosAtivos.length === 0) {
          return <span className="text-muted-foreground">Sem vínculo</span>;
        }

        return (
          <div className="space-y-0.5">
            {vinculosAtivos.map((vinculo) => (
              <div key={vinculo.contabilidade.id} className="leading-tight">
                <div className="font-medium">{vinculo.contabilidade.nome}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {vinculo.contabilidade.cnpj}
                </div>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusPill status={e.ativo ? 'autorizada' : 'cancelada'} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Empresas</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Carregando...'
              : `${total} ${total === 1 ? 'empresa' : 'empresas'} na sua carteira.`}
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
        rows={rows}
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
                <option key={r.value} value={r.value}>
                  {r.label}
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
          </>
        }
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
        onClearFilters={() => {
          setSearch('');
          setRegime('');
          setUf('');
          setPage(1);
        }}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/empresas/${row.id}`}
            onDelete={() => deleteMutation.mutate(row.id)}
            deleteTitle="Desativar empresa"
            deleteDescription={`Desativar "${row.razaoSocial}"? Notas e arquivos da empresa permanecem auditáveis.`}
          />
        )}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        totalLabelSingular="empresa"
        totalLabelPlural="empresas"
        emptyTitle={isLoading ? 'Carregando...' : 'Nenhuma empresa encontrada'}
        emptyDescription="Ajuste os filtros ou cadastre uma nova empresa."
      />
    </div>
  );
}
