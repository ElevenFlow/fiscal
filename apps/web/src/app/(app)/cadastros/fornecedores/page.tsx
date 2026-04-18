'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { UfSelect } from '@/components/forms/uf-select';
import { type Fornecedor, fornecedores as fixture } from '@/lib/mock-data';
import { Button, Money } from '@nexo/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export default function FornecedoresListPage() {
  const [rows, setRows] = useState(fixture);
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((f) => {
      if (term) {
        const match = f.razaoSocial.toLowerCase().includes(term) || f.cnpj.includes(term);
        if (!match) return false;
      }
      if (uf && f.uf !== uf) return false;
      return true;
    });
  }, [rows, search, uf]);

  const clearFilters = () => {
    setSearch('');
    setUf('');
    setPage(1);
  };

  const handleDelete = (id: string, nome: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Fornecedor "${nome}" removido (mock)`);
  };

  const columns: DataTableColumn<Fornecedor>[] = [
    {
      key: 'razao',
      header: 'Razão',
      render: (f) => <span className="font-medium">{f.razaoSocial}</span>,
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      render: (f) => <span className="font-mono text-xs">{f.cnpj}</span>,
    },
    {
      key: 'local',
      header: 'Cidade / UF',
      render: (f) => (
        <span>
          {f.cidade}/<span className="font-semibold">{f.uf}</span>
        </span>
      ),
    },
    {
      key: 'ultimaCompra',
      header: 'Última compra',
      className: 'text-xs text-muted-foreground',
      render: (f) => f.ultimaCompra,
    },
    {
      key: 'total12m',
      header: 'Total 12m',
      align: 'right',
      render: (f) => <Money value={f.totalCompras12m} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'fornecedor cadastrado' : 'fornecedores cadastrados'}.
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
        rows={filtered}
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
            onDelete={() => handleDelete(row.id, row.razaoSocial)}
            deleteTitle="Remover fornecedor"
            deleteDescription={`Remover "${row.razaoSocial}" da base? O histórico de compras permanece auditável.`}
            extra={[
              {
                label: 'Ver XMLs importados',
                onClick: () => toast.info('Filtro de XMLs (mock)'),
              },
            ]}
          />
        )}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        totalLabelSingular="fornecedor"
        totalLabelPlural="fornecedores"
        emptyTitle="Nenhum fornecedor"
        emptyDescription="Ajuste os filtros ou cadastre um novo fornecedor."
      />
    </div>
  );
}
