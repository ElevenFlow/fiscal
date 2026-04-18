'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { RowActions } from '@/components/cadastros/row-actions';
import { type Servico, servicos as fixture } from '@/lib/mock-data';
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

export default function ServicosListPage() {
  const [rows, setRows] = useState(fixture);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ativo' | 'inativo' | ''>('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (term) {
        const match =
          s.codigo.toLowerCase().includes(term) ||
          s.descricao.toLowerCase().includes(term) ||
          s.codigoMunicipal.includes(term);
        if (!match) return false;
      }
      if (status === 'ativo' && !s.ativo) return false;
      if (status === 'inativo' && s.ativo) return false;
      return true;
    });
  }, [rows, search, status]);

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPage(1);
  };

  const handleDelete = (id: string, descricao: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success(`Serviço "${descricao}" removido (mock)`);
  };

  const columns: DataTableColumn<Servico>[] = [
    {
      key: 'codigo',
      header: 'Código',
      render: (s) => <span className="font-mono text-xs font-medium">{s.codigo}</span>,
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
      render: (s) => <span className="tabular-nums">{s.aliquotaIss.toFixed(2)}%</span>,
    },
    {
      key: 'preco',
      header: 'Preço',
      align: 'right',
      render: (s) => <Money value={s.precoPadrao} />,
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
            {filtered.length}{' '}
            {filtered.length === 1 ? 'serviço no catálogo' : 'serviços no catálogo'}.
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
        rows={filtered}
        columns={columns}
        getRowId={(s) => s.id}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por código, descrição ou item municipal..."
        filters={
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
        }
        onClearFilters={clearFilters}
        actions={(row) => (
          <RowActions
            editHref={`/cadastros/servicos/${row.id}`}
            onDelete={() => handleDelete(row.id, row.descricao)}
            deleteTitle="Remover serviço"
            deleteDescription={`Remover "${row.descricao}" do catálogo? Notas já emitidas não são afetadas.`}
            extra={[
              {
                label: row.ativo ? 'Desativar' : 'Ativar',
                onClick: () => {
                  setRows((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, ativo: !r.ativo } : r)),
                  );
                  toast.info(`Serviço ${row.ativo ? 'desativado' : 'ativado'} (mock)`);
                },
              },
            ]}
          />
        )}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        totalLabelSingular="serviço"
        totalLabelPlural="serviços"
        emptyTitle="Nenhum serviço encontrado"
        emptyDescription="Ajuste os filtros ou cadastre um novo serviço."
      />
    </div>
  );
}
