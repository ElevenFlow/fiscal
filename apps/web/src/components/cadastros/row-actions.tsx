'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nexo/ui';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export interface RowActionsProps {
  viewHref?: string;
  editHref: string;
  onDelete: () => void;
  deleteTitle?: string;
  deleteDescription?: string;
  /** Itens extras exibidos no menu "mais ações". */
  extra?: Array<{ label: string; onClick: () => void }>;
}

export function RowActions({
  viewHref,
  editHref,
  onDelete,
  deleteTitle = 'Remover registro',
  deleteDescription = 'Essa ação é simulada (mock). Em produção será registrada no audit log.',
  extra,
}: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      {viewHref ? (
        <Button asChild variant="ghost" size="icon" aria-label="Ver">
          <Link href={viewHref}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="icon" aria-label="Editar">
        <Link href={editHref}>
          <Pencil className="h-4 w-4" />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {extra?.map((item) => (
            <DropdownMenuItem key={item.label} onSelect={item.onClick}>
              {item.label}
            </DropdownMenuItem>
          ))}
          {extra && extra.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            className="text-brand-danger focus:text-brand-danger"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
