'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { type Produto, produtos as fixture } from '@/lib/mock-data';
import { Badge, Button, Money, cn } from '@nexo/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const STATUS: Array<{ value: 'ativo' | 'inativo' | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'inativo', label: 'Inativos' },
];

export default function ProdutosListPage() {
  const [rows, setRows] = useState(fixture);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState<'ativo' | 'inativo' | ''>('');
  const [abaixoMinimo, setAbaixoMinimo] = useState(false);
  const [page, setPage] = useState(1);

  // Mock protótipo não tem flag ativo/inativo — consideramos todos ativos.
  // Toggle mantido para mostrar UX do filtro.
  const categorias = useMemo(() => {
    const set = new Set(rows.map((p) => p.categoria));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (term) {
        const match =
          p.sku.toLowerCase().includes(term) ||
          p.descricao.toLowerCase().includes(term) ||
          p.ncm.includes(term);
        if (!match) return false;
      }
      if (categoria && p.categoria !== categoria) return false;
      if (abaixoMinimo && p.estoque >= p.estoqueMinimo) return false;
      if (status === 'inativo') return false;
      return true;
    });
  }, [rows, search, categoria, abaixoMinimo, status]);

  const clearFilters = () => {
    setSearch('');
    setCategoria('');
    setStatus('');
    setAbaixoMinimo(false);
    setPage(1);
  };

  const handleDelete = (id: string, descricao: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Produto "${descricao}" removido (mock)`);
  };

  const columns: DataTableColumn<Produto>[] = [
    {
      key: 'sku',
      header: 'SKU',
      render: (p) => <span className="font-mono text-xs font-medium">{p.sku}</span>,
    },
    {
      key: 'descricao',
      header: 'Descrição',
      render: (p) => (
        <div>
          <div className="font-medium">{p.descricao}</div>
          <div className="text-xs text-muted-foreground">{p.categoria}</div>
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
      key: 'estoque',
      header: 'Estoque',
      align: 'right',
      render: (p) => {
        const low = p.estoque < p.estoqueMinimo;
        return (
          <Badge
            variant={low ? 'destructive' : 'secondary'}
            className={cn(
              'font-mono tabular-nums',
              low && 'bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20',
            )}
          >
            {p.estoque} {p.unidade}
            {low ? <span className="ml-1">· mín {p.estoqueMinimo}</span> : null}
          </Badge>
        );
      },
    },
    {
      key: 'precoVenda',
      header: 'Preço venda',
      align: 'right',
      render: (p) => <Money value={p.precoVenda} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <Badge variant="secondary" className="bg-brand-green/10 text-brand-green">
          Ativo
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
            {filtered.length}{' '}
            {filtered.length === 1 ? 'produto no catálogo' : 'produtos no catálogo'}.
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
        rows={filtered}
        columns={columns}
        getRowId={(p) => p.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por SKU, descrição ou NCM..."
        filters={
          <>
            <select
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-md border border-input bg-background px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Categoria"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as 'ativo' | 'inativo' | '');
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-md border border-input bg-background px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Status"
            >
              {STATUS.map((s) => (
                <option key={s.value || 'all'} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <label
              className={cn(
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors',
                abaixoMinimo
                  ? 'border-brand-danger/40 bg-brand-danger/5 text-brand-danger'
                  : 'border-input bg-background hover:bg-muted/40',
              )}
            >
              <input
                type="checkbox"
                checked={abaixoMinimo}
                onChange={(e) => {
                  setAbaixoMinimo(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-input"
              />
              <span className="font-medium">Abaixo do mínimo</span>
            </label>
          </>
        }
        onClearFilters={clearFilters}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/produtos/${row.id}`}
            onDelete={() => handleDelete(row.id, row.descricao)}
            deleteTitle="Remover produto"
            deleteDescription={`Remover "${row.descricao}" do catálogo? Produto com estoque será também zerado.`}
            extra={[
              {
                label: 'Ver movimentações',
                onClick: () => toast.info('Movimentações (mock)'),
              },
              {
                label: 'Duplicar',
                onClick: () => toast.info('Produto duplicado (mock)'),
              },
            ]}
          />
        )}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        totalLabelSingular="produto"
        totalLabelPlural="produtos"
        emptyTitle="Nenhum produto encontrado"
        emptyDescription="Ajuste os filtros ou cadastre um novo produto."
      />
    </div>
  );
}
