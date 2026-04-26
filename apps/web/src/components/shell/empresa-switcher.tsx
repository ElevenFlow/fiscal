'use client';

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
import { useEffect, useState } from 'react';
import { mockEmpresas } from '@/lib/mock-data';

/**
 * Seletor de empresa ativa no header (Plan 02-09).
 *
 * Com Clerk religado, este componente faz fetch para `/api/empresas/minhas` (Route
 * Handler proxy → apps/api). Em fallback (endpoint 404 ou rede off), usa
 * `mockEmpresas` para não quebrar a UI durante a Wave 1.
 *
 * Phase 2 CAD-02 implementa o endpoint real (depende de Plan 02-02).
 */

interface EmpresaItem {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente: 'producao' | 'homologacao';
}

export function EmpresaSwitcher() {
  const [empresas, setEmpresas] = useState<EmpresaItem[]>(mockEmpresas);
  const [selectedId, setSelectedId] = useState<string>(mockEmpresas[0]?.id ?? '');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/empresas/minhas', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as { empresas?: EmpresaItem[] };
        if (!cancelled && json.empresas?.length) {
          setEmpresas(json.empresas);
          setSelectedId((prev) => prev || (json.empresas?.[0]?.id ?? ''));
        }
      })
      .catch(() => {
        // Silencioso — fallback é mockEmpresas (já no state inicial)
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = empresas.find((e) => e.id === selectedId) ?? empresas[0];

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
        {empresas.map((empresa) => (
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
