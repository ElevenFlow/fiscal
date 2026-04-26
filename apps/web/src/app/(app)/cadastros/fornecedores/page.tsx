'use client';

/**
 * Listagem de Fornecedores — Plan 02-07 Task 3.
 *
 * Substituiu fixture mock-data por TanStack Query (`useQuery`) → /api/fornecedores.
 */

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { UfSelect } from '@/components/forms/uf-select';
import { Button } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

interface FornecedorListItem {
  id: string;
  cpfCnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  endereco: { cidade?: string; uf?: string } | null;
  email: string | null;
  ativo: boolean;
  createdAt: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export default function FornecedoresListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<PageResult<FornecedorListItem>>({
    queryKey: ['fornecedores', { page, pageSize, search, uf }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
        ...(uf ? { uf } : {}),
      });
      const res = await fetch(`/api/fornecedores?${params}`);
      if (!res.ok) throw new Error('Falha ao carregar fornecedores');
      return (await res.json()) as PageResult<FornecedorListItem>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/fornecedores/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success('Fornecedor desativado');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const clearFilters = () => {
    setSearch('');
    setUf('');
    setPage(1);
  };

  const columns: DataTableColumn<FornecedorListItem>[] = [
    {
      key: 'razao',
      header: 'Razão',
      render: (f) => <span className="font-medium">{f.razaoSocial}</span>,
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      render: (f) => <span className="font-mono text-xs">{f.cpfCnpj}</span>,
    },
    {
      key: 'local',
      header: 'Cidade / UF',
      render: (f) => {
        const cidade = f.endereco?.cidade ?? '—';
        const ufVal = f.endereco?.uf ?? '—';
        return (
          <span>
            {cidade}/<span className="font-semibold">{ufVal}</span>
          </span>
        );
      },
    },
    {
      key: 'email',
      header: 'E-mail',
      className: 'text-xs text-muted-foreground',
      render: (f) => f.email ?? '—',
    },
    {
      key: 'createdAt',
      header: 'Cadastrado',
      className: 'text-xs text-muted-foreground',
      render: (f) =>
        f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Carregando...'
              : `${total} ${total === 1 ? 'fornecedor cadastrado' : 'fornecedores cadastrados'}.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/cadastros/fornecedores/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo fornecedor
          </Link>
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(f) => f.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por razão ou CNPJ..."
        filters={
          <UfSelect
            className="h-9 w-24"
            value={uf}
            onChange={(v) => {
              setUf(v);
              setPage(1);
            }}
          />
        }
        onClearFilters={clearFilters}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/fornecedores/${row.id}`}
            onDelete={() => deleteMutation.mutate(row.id)}
            deleteTitle="Desativar fornecedor"
            deleteDescription={`Desativar "${row.razaoSocial}"? O histórico de XML permanece auditável.`}
          />
        )}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        totalLabelSingular="fornecedor"
        totalLabelPlural="fornecedores"
        emptyTitle={isLoading ? 'Carregando...' : 'Nenhum fornecedor'}
        emptyDescription="Ajuste os filtros ou cadastre um novo fornecedor."
      />
    </div>
  );
}
