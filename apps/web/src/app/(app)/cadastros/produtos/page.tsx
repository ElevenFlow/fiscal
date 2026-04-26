'use client';

/**
 * Listagem de Produtos — Plan 02-07 Task 3.
 */

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { Badge, Button, Money, cn } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProdutoListItem {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string;
  unidade: string;
  precoCusto: string | null;
  precoVenda: string;
  estoqueAtual?: string | null;
  estoqueMinimo?: string | null;
  categoria: string | null;
  ativo: boolean;
  createdAt: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ProdutosListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<PageResult<ProdutoListItem>>({
    queryKey: ['produtos', { page, pageSize, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/produtos?${params}`);
      if (!res.ok) throw new Error('Falha ao carregar produtos');
      return (await res.json()) as PageResult<ProdutoListItem>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      toast.success('Produto desativado');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: DataTableColumn<ProdutoListItem>[] = [
    {
      key: 'codigo',
      header: 'SKU',
      render: (p) => <span className="font-mono text-xs font-medium">{p.codigo}</span>,
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: (p) => (
        <div>
          <div className="font-medium">{p.descricao}</div>
          {p.categoria ? (
            <div className="text-xs text-muted-foreground">{p.categoria}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'ncm',
      header: 'NCM',
      render: (p) => <span className="font-mono text-xs">{p.ncm}</span>,
    },
    {
      key: 'unidade',
      header: 'UN',
      align: 'center',
      render: (p) => <span className="text-xs font-semibold">{p.unidade}</span>,
    },
    {
      key: 'precoVenda',
      header: 'Preço venda',
      align: 'right',
      render: (p) => <Money value={Number(p.precoVenda)} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge
          variant="secondary"
          className={cn(
            p.ativo ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground',
          )}
        >
          {p.ativo ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Carregando...'
              : `${total} ${total === 1 ? 'produto no catálogo' : 'produtos no catálogo'}.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/cadastros/produtos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Link>
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(p) => p.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por SKU, descrição ou NCM..."
        onClearFilters={() => {
          setSearch('');
          setPage(1);
        }}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/produtos/${row.id}`}
            onDelete={() => deleteMutation.mutate(row.id)}
            deleteTitle="Desativar produto"
            deleteDescription={`Desativar "${row.descricao}"? Notas já emitidas não são afetadas.`}
          />
        )}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        totalLabelSingular="produto"
        totalLabelPlural="produtos"
        emptyTitle={isLoading ? 'Carregando...' : 'Nenhum produto encontrado'}
        emptyDescription="Ajuste a busca ou cadastre um novo produto."
      />
    </div>
  );
}
