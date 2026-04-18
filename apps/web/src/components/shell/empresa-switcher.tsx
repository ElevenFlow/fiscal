'use client';

import { mockEmpresas } from '@/lib/mock-data';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@nexo/ui';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

/**
 * Seletor de empresa ativa no header.
 *
 * MODO PROTÓTIPO: consome `mockEmpresas` diretamente, sem fetch. O estado de
 * "empresa selecionada" é apenas client state — não persiste no mock-auth
 * ainda (o contexto só controla perfil).
 */
export function EmpresaSwitcher() {
  const [selectedId, setSelectedId] = useState<string>(mockEmpresas[0]?.id ?? '');
  const selected = mockEmpresas.find((e) => e.id === selectedId) ?? mockEmpresas[0];

  if (!selected) {
    return (
      <Button variant="outline" className="w-64 justify-between gap-2" disabled>
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Nenhuma empresa</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-64 justify-between gap-2"
          aria-label={`Empresa ativa: ${selected.razaoSocial}`}
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col items-start leading-none">
            <span className="text-xs text-muted-foreground">Empresa ativa</span>
            <span className="max-w-full truncate text-sm font-medium">{selected.razaoSocial}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {mockEmpresas.map((empresa) => (
          <DropdownMenuItem
            key={empresa.id}
            onClick={() => setSelectedId(empresa.id)}
            className="flex items-center gap-2"
          >
            <Check
              className={cn(
                'h-4 w-4 shrink-0',
                selected.id === empresa.id ? 'opacity-100' : 'opacity-0',
              )}
            />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{empresa.razaoSocial}</span>
              <span className="font-mono text-xs text-muted-foreground">{empresa.cnpj}</span>
            </div>
            {empresa.ambiente === 'homologacao' && (
              <Badge variant="warning" className="text-[10px]">
                HOMOLOG
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-brand-blue">+ Nova empresa</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
