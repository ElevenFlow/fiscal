'use client';

/**
 * Listagem de Serviços — Plan 02-07 Task 3.
 */

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { Badge, Button, Money, cn } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

interface ServicoListItem {
  id: string;
  codigoInterno: string;
  descricao: string;
  codigoMunicipal: string;
  cnae: string | null;
  precoPadrao: string;
  aliquotaIss: string;
  ativo: boolean;
  createdAt: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export default function ServicosListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<PageResult<ServicoListItem>>({
    queryKey: ['servicos', { page, pageSize, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/servicos?${params}`);
      if (!res.ok) throw new Error('Falha ao carregar serviços');
      return (await res.json()) as PageResult<ServicoListItem>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/servicos/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Serviço desativado');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const columns: DataTableColumn<ServicoListItem>[] = [
    {
      key: 'codigo',
      header: 'Código',
      render: (s) => <span className="font-mono text-xs font-medium">{s.codigoInterno}</span>,
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: (s) => <span className="font-medium">{s.descricao}</span>,
    },
    {
      key: 'municipal',
      header: 'Cód. Municipal',
      render: (s) => <span className="font-mono text-xs">{s.codigoMunicipal}</span>,
    },
    {
      key: 'iss',
      header: 'Alíquota ISS',
      align: 'right',
      render: (s) => <span className="tabular-nums">{Number(s.aliquotaIss).toFixed(2)}%</span>,
    },
    {
      key: 'preco',
      header: 'Preço',
      align: 'right',
      render: (s) => <Money value={Number(s.precoPadrao)} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <Badge
          variant="secondary"
          className={cn(
            s.ativo ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground',
          )}
        >
          {s.ativo ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Serviços</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Carregando...'
              : `${total} ${total === 1 ? 'serviço no catálogo' : 'serviços no catálogo'}.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/cadastros/servicos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo serviço
          </Link>
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(s) => s.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por código, descrição ou item municipal..."
        onClearFilters={() => {
          setSearch('');
          setPage(1);
        }}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/servicos/${row.id}`}
            onDelete={() => deleteMutation.mutate(row.id)}
            deleteTitle="Desativar serviço"
            deleteDescription={`Desativar "${row.descricao}"? Notas já emitidas não são afetadas.`}
          />
        )}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        totalLabelSingular="serviço"
        totalLabelPlural="serviços"
        emptyTitle={isLoading ? 'Carregando...' : 'Nenhum serviço encontrado'}
        emptyDescription="Ajuste a busca ou cadastre um novo serviço."
      />
    </div>
  );
}
