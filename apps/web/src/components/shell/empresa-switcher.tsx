'use client';

import { type MockEmpresa, mockEmpresas } from '@/lib/mock-data';
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
 * Seletor de empresa ativa no header (FOUND-13).
 *
 * Em Plan 07 (Clerk + API), dados virão de `GET /api/empresas` filtrado pela
 * contabilidade do usuário autenticado. A seleção persiste via cookie server-side
 * para o middleware injetar `tenant_id` em requests subsequentes.
 */
export function EmpresaSwitcher() {
  const [selected, setSelected] = useState<MockEmpresa>(mockEmpresas[0] as MockEmpresa);

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
            onClick={() => setSelected(empresa)}
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
