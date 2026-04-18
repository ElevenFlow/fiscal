'use client';

import { Button, Card, Input, cn } from '@nexo/ui';
import { Search } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from './empty-state';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  onClearFilters?: () => void;
  actions?: (row: T) => ReactNode;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  totalLabelSingular: string;
  totalLabelPlural: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  filters,
  onClearFilters,
  actions,
  page,
  pageSize,
  onPageChange,
  totalLabelSingular,
  totalLabelPlural,
  emptyTitle = 'Nada para mostrar',
  emptyDescription = 'Tente ajustar os filtros ou limpar a busca.',
}: DataTableProps<T>) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageRows = rows.slice(startIdx, endIdx);

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-label="Buscar"
            />
          </div>
          {filters ? (
            <div className="flex flex-wrap items-center gap-2">
              {filters}
              {onClearFilters ? (
                <Button variant="ghost" size="sm" onClick={onClearFilters}>
                  Limpar
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {/* Tabela / empty */}
      {total === 0 ? (
        <EmptyState
          icon={Inbox}
          title={emptyTitle}
          description={emptyDescription}
          action={onClearFilters ? { label: 'Limpar filtros', onClick: onClearFilters } : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-4 py-3 font-semibold',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                  {actions ? <th className="px-4 py-3 text-right font-semibold">Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr
                    key={getRowId(row)}
                    className={cn(
                      'border-b last:border-0 transition-colors hover:bg-muted/30',
                      idx % 2 === 1 && 'bg-muted/10',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 align-middle',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                    {actions ? (
                      <td className="px-4 py-3 text-right align-middle">{actions(row)}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              Mostrando {startIdx + 1}-{endIdx} de {total}{' '}
              {total === 1 ? totalLabelSingular : totalLabelPlural}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => onPageChange(safePage - 1)}
              >
                Anterior
              </Button>
              <span className="px-2 tabular-nums">
                Página {safePage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => onPageChange(safePage + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
