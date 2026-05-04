'use client';

import { useMockRole } from '@/lib/mock-auth';
import type { Role } from '@/lib/mock-data';
import { Card, CardContent } from '@nexo/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  ChevronRight,
  type LucideIcon,
  Package,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';

interface HubCard {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  roles: Role[];
  countKey: string;
  countEndpoint: string;
  countSingular: string;
  countPlural: string;
}

interface PageResult {
  items?: unknown[];
  total?: number;
}

/**
 * Busca contagem do recurso. Suporta dois shapes:
 *  - { items, total }  → endpoints paginados (/api/clientes etc)
 *  - unknown[]         → endpoints custom (/api/empresas/minhas)
 */
async function fetchCount(endpoint: string): Promise<number> {
  const res = await fetch(endpoint, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown = await res.json();
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object') {
    const obj = data as PageResult & { empresas?: unknown[] };
    if (typeof obj.total === 'number') return obj.total;
    if (Array.isArray(obj.items)) return obj.items.length;
    if (Array.isArray(obj.empresas)) return obj.empresas.length;
  }
  return 0;
}

function CountLine({ card }: { card: HubCard }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hub-count', card.countKey],
    queryFn: () => fetchCount(card.countEndpoint),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="mt-0.5 text-xs font-medium text-muted-foreground">Carregando…</div>;
  }
  if (isError || data === undefined) return null;

  const label = data === 1 ? card.countSingular : card.countPlural;
  return (
    <div className="mt-0.5 text-xs font-medium text-muted-foreground">
      {data} {label}
    </div>
  );
}

export function CadastrosHubCards() {
  const role = useMockRole();
  const allCards: HubCard[] = [
    {
      href: '/cadastros/empresas',
      title: 'Empresas',
      description: 'Cadastro completo por empresa — certificado, regime e endereço.',
      icon: Building2,
      accent: 'bg-brand-blue/10 text-brand-blue',
      roles: ['admin', 'contabilidade'],
      countKey: 'empresas',
      countEndpoint: '/api/empresas/minhas',
      countSingular: 'empresa cadastrada',
      countPlural: 'empresas cadastradas',
    },
    {
      href: '/cadastros/contabilidades',
      title: 'Contabilidades',
      description: 'Escritórios e responsáveis técnicos com suas carteiras.',
      icon: Briefcase,
      accent: 'bg-brand-green/10 text-brand-green',
      roles: ['admin'],
      countKey: 'contabilidades',
      countEndpoint: '/api/contabilidades?page=1&pageSize=1',
      countSingular: 'contabilidade',
      countPlural: 'contabilidades',
    },
    {
      href: '/cadastros/clientes',
      title: 'Clientes',
      description: 'PF e PJ — base única para emissão de NFS-e e NF-e.',
      icon: Users,
      accent: 'bg-brand-blue/10 text-brand-blue',
      roles: ['admin', 'contabilidade', 'empresa'],
      countKey: 'clientes',
      countEndpoint: '/api/clientes?page=1&pageSize=1',
      countSingular: 'cliente',
      countPlural: 'clientes',
    },
    {
      href: '/cadastros/fornecedores',
      title: 'Fornecedores',
      description: 'Parceiros comerciais com histórico de compras e condições.',
      icon: Truck,
      accent: 'bg-amber-500/10 text-amber-600',
      roles: ['admin', 'contabilidade', 'empresa'],
      countKey: 'fornecedores',
      countEndpoint: '/api/fornecedores?page=1&pageSize=1',
      countSingular: 'fornecedor',
      countPlural: 'fornecedores',
    },
    {
      href: '/cadastros/produtos',
      title: 'Produtos',
      description: 'SKUs com NCM, CFOP, preços e controle de estoque.',
      icon: Package,
      accent: 'bg-purple-500/10 text-purple-600',
      roles: ['admin', 'contabilidade', 'empresa'],
      countKey: 'produtos',
      countEndpoint: '/api/produtos?page=1&pageSize=1',
      countSingular: 'produto',
      countPlural: 'produtos',
    },
    {
      href: '/cadastros/servicos',
      title: 'Serviços',
      description: 'Catálogo com código municipal (LC 116) e alíquota ISS.',
      icon: Wrench,
      accent: 'bg-brand-green/10 text-brand-green',
      roles: ['admin', 'contabilidade', 'empresa'],
      countKey: 'servicos',
      countEndpoint: '/api/servicos?page=1&pageSize=1',
      countSingular: 'serviço',
      countPlural: 'serviços',
    },
  ];
  const cards = allCards.filter((card) => card.roles.includes(role));

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full transition-all group-hover:border-primary/40 group-hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${card.accent}`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold">{card.title}</h2>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <CountLine card={card} />
                  <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
