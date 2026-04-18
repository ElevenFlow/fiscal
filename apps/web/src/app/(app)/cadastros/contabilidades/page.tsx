'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { UfSelect } from '@/components/forms/uf-select';
import { type Contabilidade, contabilidades as fixture } from '@/lib/mock-data';
import { Badge, Button, cn } from '@nexo/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const FAIXAS = [
  { value: '', label: 'Todas as carteiras' },
  { value: 'ate10', label: 'Até 10 empresas' },
  { value: '11a25', label: '11 a 25 empresas' },
  { value: '26mais', label: '26 ou mais' },
];

function matchFaixa(carteira: number, faixa: string) {
  if (!faixa) return true;
  if (faixa === 'ate10') return carteira <= 10;
  if (faixa === '11a25') return carteira >= 11 && carteira <= 25;
  if (faixa === '26mais') return carteira >= 26;
  return true;
}

export default function ContabilidadesListPage() {
  const [rows, setRows] = useState(fixture);
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('');
  const [faixa, setFaixa] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (term) {
        const match =
          c.razaoSocial.toLowerCase().includes(term) ||
          c.cnpj.includes(term) ||
          c.responsavel.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (uf && c.uf !== uf) return false;
      if (!matchFaixa(c.carteira, faixa)) return false;
      return true;
    });
  }, [rows, search, uf, faixa]);

  const clearFilters = () => {
    setSearch('');
    setUf('');
    setFaixa('');
    setPage(1);
  };

  const handleDelete = (id: string, nome: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Contabilidade "${nome}" removida (mock)`);
  };

  const columns: DataTableColumn<Contabilidade>[] = [
    {
      key: 'razao',
      header: 'Razão',
      render: (c) => <span className="font-medium">{c.razaoSocial}</span>,
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      render: (c) => <span className="font-mono text-xs">{c.cnpj}</span>,
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
      key: 'carteira',
      header: 'Carteira',
      render: (c) => (
        <Badge variant="secondary" className="font-normal">
          {c.carteira} {c.carteira === 1 ? 'empresa' : 'empresas'}
        </Badge>
      ),
    },
    { key: 'responsavel', header: 'Responsável', render: (c) => c.responsavel },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contabilidades</h1>
          <p className="text-muted-foreground">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'contabilidade cadastrada' : 'contabilidades cadastradas'}.
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
        rows={filtered}
        columns={columns}
        getRowId={(c) => c.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por razão, CNPJ ou responsável..."
        filters={
          <>
            <UfSelect
              className="h-9 w-24"
              value={uf}
              onChange={(v) => {
                setUf(v);
                setPage(1);
              }}
            />
            <select
              value={faixa}
              onChange={(e) => {
                setFaixa(e.target.value);
                setPage(1);
              }}
              className={cn(
                'h-9 rounded-md border border-input bg-background px-3 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label="Faixa de carteira"
            >
              {FAIXAS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </>
        }
        onClearFilters={clearFilters}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/contabilidades/${row.id}`}
            onDelete={() => handleDelete(row.id, row.razaoSocial)}
            deleteTitle="Remover contabilidade"
            deleteDescription={`Remover "${row.razaoSocial}" da base? As empresas vinculadas ficam sem contabilidade responsável.`}
            extra={[
              {
                label: 'Ver empresas vinculadas',
                onClick: () => toast.info('Filtro por contabilidade (mock)'),
              },
            ]}
          />
        )}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        totalLabelSingular="contabilidade"
        totalLabelPlural="contabilidades"
        emptyTitle="Nenhuma contabilidade"
        emptyDescription="Ajuste os filtros ou cadastre uma nova contabilidade."
      />
    </div>
  );
}
