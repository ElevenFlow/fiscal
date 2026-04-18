'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { UfSelect } from '@/components/forms/uf-select';
import { type Cliente, clientes as fixture } from '@/lib/mock-data';
import { Badge, Button, cn } from '@nexo/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const TIPOS: Array<{ value: Cliente['tipo'] | ''; label: string }> = [
  { value: '', label: 'PF e PJ' },
  { value: 'PF', label: 'Pessoa Física' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
];

export default function ClientesListPage() {
  const [rows, setRows] = useState(fixture);
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<Cliente['tipo'] | ''>('');
  const [uf, setUf] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (term) {
        const match =
          c.nome.toLowerCase().includes(term) ||
          c.documento.includes(term) ||
          (c.email?.toLowerCase().includes(term) ?? false);
        if (!match) return false;
      }
      if (tipo && c.tipo !== tipo) return false;
      if (uf && c.uf !== uf) return false;
      return true;
    });
  }, [rows, search, tipo, uf]);

  const clearFilters = () => {
    setSearch('');
    setTipo('');
    setUf('');
    setPage(1);
  };

  const handleDelete = (id: string, nome: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Cliente "${nome}" removido (mock)`);
  };

  const columns: DataTableColumn<Cliente>[] = [
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
      key: 'documento',
      header: 'CPF / CNPJ',
      render: (c) => <span className="font-mono text-xs">{c.documento}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (c) => (
        <Badge
          variant="secondary"
          className={cn(
            'font-medium',
            c.tipo === 'PJ' && 'bg-brand-blue/10 text-brand-blue',
            c.tipo === 'PF' && 'bg-brand-green/10 text-brand-green',
          )}
        >
          {c.tipo}
        </Badge>
      ),
    },
    {
      key: 'local',
      header: 'Cidade / UF',
      render: (c) => (
        <span>
          {c.cidade}/<span className="font-semibold">{c.uf}</span>
        </span>
      ),
    },
    {
      key: 'ultimaCompra',
      header: 'Última compra',
      className: 'text-xs text-muted-foreground',
      render: (c) => c.ultimaCompra ?? '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'} na base.
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
        rows={filtered}
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
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as Cliente['tipo'] | '');
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
            onDelete={() => handleDelete(row.id, row.nome)}
            deleteTitle="Remover cliente"
            deleteDescription={`Remover "${row.nome}" da base? Esta ação é simulada.`}
            extra={[
              {
                label: 'Ver histórico de compras',
                onClick: () => toast.info('Histórico do cliente (mock)'),
              },
            ]}
          />
        )}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        totalLabelSingular="cliente"
        totalLabelPlural="clientes"
        emptyTitle="Nenhum cliente encontrado"
        emptyDescription="Ajuste os filtros ou crie um novo cliente."
      />
    </div>
  );
}
