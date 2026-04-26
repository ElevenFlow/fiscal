'use client';

/**
 * Listagem de Clientes — Plan 02-07 Task 3.
 *
 * Substituiu fixture mock-data por TanStack Query (`useQuery`) chamando
 * Route Handler `/api/clientes` (proxy Bearer Clerk server-side).
 *
 * Filtros (search, tipoPessoa, uf) entram no queryKey → server-side filtering.
 * Soft delete via `useMutation` + `qc.invalidateQueries` (refetch).
 */

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { UfSelect } from '@/components/forms/uf-select';
import { Badge, Button, cn } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

interface ClienteListItem {
  id: string;
  tipoPessoa: 'fisica' | 'juridica';
  cpfCnpj: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: { cidade?: string; uf?: string } | null;
  ativo: boolean;
  createdAt: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

const TIPOS: Array<{ value: 'fisica' | 'juridica' | ''; label: string }> = [
  { value: '', label: 'PF e PJ' },
  { value: 'fisica', label: 'Pessoa Física' },
  { value: 'juridica', label: 'Pessoa Jurídica' },
];

export default function ClientesListPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'fisica' | 'juridica' | ''>('');
  const [uf, setUf] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<PageResult<ClienteListItem>>({
    queryKey: ['clientes', { page, pageSize, search, tipoPessoa, uf }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(search ? { search } : {}),
        ...(tipoPessoa ? { tipoPessoa } : {}),
        ...(uf ? { uf } : {}),
      });
      const res = await fetch(`/api/clientes?${params}`);
      if (!res.ok) throw new Error('Falha ao carregar clientes');
      return (await res.json()) as PageResult<ClienteListItem>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente desativado');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const clearFilters = () => {
    setSearch('');
    setTipoPessoa('');
    setUf('');
    setPage(1);
  };

  const columns: DataTableColumn<ClienteListItem>[] = [
    {
      key: 'nome',
      header: 'Nome / Razão',
      render: (c) => (
        <div>
          <div className="font-medium">{c.nome}</div>
          {c.email ? <div className="text-xs text-muted-foreground">{c.email}</div> : null}
        </div>
      ),
    },
    {
      key: 'cpfCnpj',
      header: 'CPF / CNPJ',
      render: (c) => <span className="font-mono text-xs">{c.cpfCnpj}</span>,
    },
    {
      key: 'tipoPessoa',
      header: 'Tipo',
      render: (c) => (
        <Badge
          variant="secondary"
          className={cn(
            'font-medium',
            c.tipoPessoa === 'juridica' && 'bg-brand-blue/10 text-brand-blue',
            c.tipoPessoa === 'fisica' && 'bg-brand-green/10 text-brand-green',
          )}
        >
          {c.tipoPessoa === 'juridica' ? 'PJ' : 'PF'}
        </Badge>
      ),
    },
    {
      key: 'local',
      header: 'Cidade / UF',
      render: (c) => {
        const cidade = c.endereco?.cidade ?? '—';
        const ufVal = c.endereco?.uf ?? '—';
        return (
          <span>
            {cidade}/<span className="font-semibold">{ufVal}</span>
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Cadastrado em',
      className: 'text-xs text-muted-foreground',
      render: (c) =>
        c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            {isLoading
              ? 'Carregando...'
              : `${total} ${total === 1 ? 'cliente' : 'clientes'} na base.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/cadastros/clientes/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
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
        searchPlaceholder="Buscar por nome, documento ou e-mail..."
        filters={
          <>
            <select
              value={tipoPessoa}
              onChange={(e) => {
                setTipoPessoa(e.target.value as 'fisica' | 'juridica' | '');
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-md border border-input bg-background px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Tipo"
            >
              {TIPOS.map((t) => (
                <option key={t.value || 'all'} value={t.value}>
                  {t.label}
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
            />
          </>
        }
        onClearFilters={clearFilters}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/clientes/${row.id}`}
            onDelete={() => deleteMutation.mutate(row.id)}
            deleteTitle="Desativar cliente"
            deleteDescription={`Desativar "${row.nome}"? O histórico fiscal permanece auditável.`}
            extra={[
              {
                label: 'Ver histórico de notas',
                onClick: () => toast.info('Histórico do cliente (em breve)'),
              },
            ]}
          />
        )}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        totalLabelSingular="cliente"
        totalLabelPlural="clientes"
        emptyTitle={isLoading ? 'Carregando...' : 'Nenhum cliente encontrado'}
        emptyDescription="Ajuste os filtros ou crie um novo cliente."
      />
    </div>
  );
}
