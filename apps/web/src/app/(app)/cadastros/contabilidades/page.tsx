'use client';

/**
 * Listagem de Contabilidades — Plan 02-07 Task 3.
 *
 * Contabilidade é UNIQUE global (não tenant-scoped) — apenas platform_admin
 * acessa via RBAC backend. Frontend lista o que o backend autorizar.
 */

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { Button } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

interface ContabilidadeListItem {
  id: string;
  nome: string;
  cnpj: string;
  endereco: { cidade?: string; uf?: string } | null;
  contatos: { responsavel?: string; email?: string } | null;
  createdAt: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ContabilidadesListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<PageResult<ContabilidadeListItem>>({
    queryKey: ['contabilidades', { page, pageSize, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/contabilidades?${params}`);
      if (!res.ok) throw new Error('Falha ao carregar contabilidades');
      return (await res.json()) as PageResult<ContabilidadeListItem>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contabilidades/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contabilidades'] });
      toast.success('Contabilidade removida');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: DataTableColumn<ContabilidadeListItem>[] = [
    {
      key: 'nome',
      header: 'Nome',
      render: (c) => <span className="font-medium">{c.nome}</span>,
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      render: (c) => <span className="font-mono text-xs">{c.cnpj}</span>,
    },
    {
      key: 'local',
      header: 'Cidade / UF',
      render: (c) => {
        const cidade = c.endereco?.cidade ?? '—';
        const uf = c.endereco?.uf ?? '—';
        return (
          <span>
            {cidade}/<span className="font-semibold">{uf}</span>
          </span>
        );
      },
    },
    {
      key: 'responsavel',
      header: 'Responsável',
      render: (c) => c.contatos?.responsavel ?? '—',
    },
    {
      key: 'email',
      header: 'E-mail',
      className: 'text-xs text-muted-foreground',
      render: (c) => c.contatos?.email ?? '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contabilidades</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Carregando...'
              : `${total} ${total === 1 ? 'contabilidade cadastrada' : 'contabilidades cadastradas'}.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/cadastros/contabilidades/novo">
            <Plus className="mr-2 h-4 w-4" />
            Nova contabilidade
          </Link>
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(c) => c.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por nome ou CNPJ..."
        onClearFilters={() => {
          setSearch('');
          setPage(1);
        }}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/contabilidades/${row.id}`}
            onDelete={() => deleteMutation.mutate(row.id)}
            deleteTitle="Remover contabilidade"
            deleteDescription={`Remover "${row.nome}"? As empresas vinculadas ficam sem contabilidade responsável.`}
          />
        )}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        totalLabelSingular="contabilidade"
        totalLabelPlural="contabilidades"
        emptyTitle={isLoading ? 'Carregando...' : 'Nenhuma contabilidade'}
        emptyDescription="Ajuste a busca ou cadastre uma nova contabilidade."
      />
    </div>
  );
}
