'use client';

import { useMockUser } from '@/lib/mock-auth';
import { empresas as mockEmpresas } from '@/lib/mock-data';
import type { MockUser } from '@/lib/mock-auth';
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

interface EmpresaItem {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente?: 'producao' | 'homologacao';
}

/**
 * Fallback mock — usado quando o backend NestJS nao esta deployado/acessivel.
 * Filtra por perfil ativo do MockAuthProvider. Ver PEND-027 em
 * .planning/PENDENCIAS.md (deploy do apps/api remove a necessidade).
 */
function mockEmpresasForUser(user: MockUser): EmpresaItem[] {
  const filtered = mockEmpresas.filter((e) => {
    if (user.perfil === 'admin') return true;
    if (user.perfil === 'contabilidade') return e.contabilidadeId === user.contabilidadeId;
    return e.id === user.empresaAtivaId;
  });
  return filtered.map((e) => ({
    id: e.id,
    razaoSocial: e.razaoSocial,
    cnpj: e.cnpj,
    ambiente: 'producao',
  }));
}

export function EmpresaSwitcher() {
  const user = useMockUser();
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/empresas/minhas', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as { empresas?: EmpresaItem[] };
        if (cancelled) return;

        const nextEmpresas = json.empresas?.length ? json.empresas : mockEmpresasForUser(user);
        setEmpresas(nextEmpresas);
        setSelectedId((prev) =>
          nextEmpresas.some((empresa) => empresa.id === prev) ? prev : (nextEmpresas[0]?.id ?? ''),
        );
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = mockEmpresasForUser(user);
        setEmpresas(fallback);
        setSelectedId(fallback[0]?.id ?? '');
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
        <DropdownMenuItem asChild className="text-brand-blue">
          <a href="/cadastros/empresas/novo">+ Nova empresa</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
