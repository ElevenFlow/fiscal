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

/**
 * Shape retornado por `GET /api/empresas/minhas` (Plan 07).
 * Phase 2 formaliza o contrato completo; por ora espelha `MockEmpresa`.
 */
export interface EmpresaDTO {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente: 'producao' | 'homologacao';
}

/**
 * Seletor de empresa ativa no header (FOUND-13).
 *
 * Integração Plan 07:
 *  - Client component chama Route Handler `GET /api/empresas/minhas`
 *    (BLOCKER #2 Option A — same-origin, cookies Clerk).
 *  - Route handler faz fetch server-side ao apps/api com Bearer JWT.
 *  - Phase 2 (CAD-02) trocará a stub response por query real:
 *    `empresas → contabilidade_empresas → contabilidade (clerk_org_id)`.
 *
 * Persistência de seleção (POST /empresas/:id/select que seta publicMetadata.activeEmpresaId)
 * fica para Phase 2 — por ora seleção é apenas client state.
 */
export function EmpresaSwitcher() {
  const [empresas, setEmpresas] = useState<EmpresaDTO[]>([]);
  const [selected, setSelected] = useState<EmpresaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/empresas/minhas', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as { empresas: EmpresaDTO[] };
        if (cancelled) return;
        setEmpresas(data.empresas ?? []);
        setSelected(data.empresas?.[0] ?? null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Button variant="outline" className="w-64 justify-between gap-2" disabled>
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </Button>
    );
  }

  if (error || !selected) {
    return (
      <Button variant="outline" className="w-64 justify-between gap-2" disabled>
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {error ? 'Erro ao carregar' : 'Nenhuma empresa'}
        </span>
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
