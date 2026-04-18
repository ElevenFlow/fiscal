import {
  clientes,
  contabilidades,
  empresas,
  fornecedores,
  produtos,
  servicos,
} from '@/lib/mock-data';
import { Card, CardContent } from '@nexo/ui';
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

export const metadata = { title: 'Cadastros' };

interface HubCard {
  href: string;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  icon: LucideIcon;
  accent: string;
}

export default function CadastrosHubPage() {
  const cards: HubCard[] = [
    {
      href: '/cadastros/empresas',
      title: 'Empresas',
      description: 'Cadastro completo por empresa — certificado, regime e endereço.',
      count: empresas.length,
      countLabel: empresas.length === 1 ? 'empresa cadastrada' : 'empresas cadastradas',
      icon: Building2,
      accent: 'bg-brand-blue/10 text-brand-blue',
    },
    {
      href: '/cadastros/contabilidades',
      title: 'Contabilidades',
      description: 'Escritórios e responsáveis técnicos com suas carteiras.',
      count: contabilidades.length,
      countLabel: contabilidades.length === 1 ? 'contabilidade' : 'contabilidades',
      icon: Briefcase,
      accent: 'bg-brand-green/10 text-brand-green',
    },
    {
      href: '/cadastros/clientes',
      title: 'Clientes',
      description: 'PF e PJ — base única para emissão de NFS-e e NF-e.',
      count: clientes.length,
      countLabel: clientes.length === 1 ? 'cliente' : 'clientes',
      icon: Users,
      accent: 'bg-brand-blue/10 text-brand-blue',
    },
    {
      href: '/cadastros/fornecedores',
      title: 'Fornecedores',
      description: 'Parceiros comerciais com histórico de compras e condições.',
      count: fornecedores.length,
      countLabel: fornecedores.length === 1 ? 'fornecedor' : 'fornecedores',
      icon: Truck,
      accent: 'bg-amber-500/10 text-amber-600',
    },
    {
      href: '/cadastros/produtos',
      title: 'Produtos',
      description: 'SKUs com NCM, CFOP, preços e controle de estoque.',
      count: produtos.length,
      countLabel: produtos.length === 1 ? 'produto' : 'produtos',
      icon: Package,
      accent: 'bg-purple-500/10 text-purple-600',
    },
    {
      href: '/cadastros/servicos',
      title: 'Serviços',
      description: 'Catálogo com código municipal (LC 116) e alíquota ISS.',
      count: servicos.length,
      countLabel: servicos.length === 1 ? 'serviço' : 'serviços',
      icon: Wrench,
      accent: 'bg-brand-green/10 text-brand-green',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
        <p className="text-muted-foreground">
          Base mestre de empresas, contabilidades, parceiros e catálogo. Tudo o que alimenta a
          emissão fiscal está aqui.
        </p>
      </div>

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
                    <div className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {card.count} {card.countLabel}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
