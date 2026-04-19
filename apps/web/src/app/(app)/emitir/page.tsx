import { Card, CardContent } from '@nexo/ui';
import { ArrowRight, FileText, RotateCcw, Scroll } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Emitir nota' };

interface HubOption {
  href: string;
  icon: typeof FileText;
  title: string;
  description: string;
  accent: string;
  accentBg: string;
}

const opcoes: HubOption[] = [
  {
    href: '/emitir/nfs-e',
    icon: Scroll,
    title: 'NFS-e',
    description:
      'Nota Fiscal de Serviço eletrônica. Emitida para a prefeitura do município do prestador.',
    accent: 'text-brand-blue',
    accentBg: 'bg-brand-blue/10',
  },
  {
    href: '/emitir/nf-e',
    icon: FileText,
    title: 'NF-e',
    description:
      'Nota Fiscal eletrônica modelo 55 para venda de produtos. Transmitida à SEFAZ estadual.',
    accent: 'text-brand-green',
    accentBg: 'bg-brand-green/10',
  },
  {
    href: '/emitir/devolucao',
    icon: RotateCcw,
    title: 'Nota de devolução',
    description:
      'NF-e de devolução de compra. Selecione a nota de origem e itens a devolver ao fornecedor.',
    accent: 'text-brand-warning',
    accentBg: 'bg-brand-warning/10',
  },
];

export default function EmitirHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Emitir nota fiscal</h1>
        <p className="text-muted-foreground">
          Escolha o tipo de documento que você deseja emitir. Toda a emissão abaixo é simulada (modo
          protótipo).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {opcoes.map((op) => {
          const Icon = op.icon;
          return (
            <Link
              key={op.href}
              href={op.href}
              className="group focus-visible:outline-none"
              aria-label={`Emitir ${op.title}`}
            >
              <Card className="h-full transition-all group-hover:border-brand-blue group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${op.accentBg}`}
                  >
                    <Icon className={`h-6 w-6 ${op.accent}`} aria-hidden />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">{op.title}</h2>
                    <p className="text-sm text-muted-foreground">{op.description}</p>
                  </div>
                  <div
                    className={`mt-auto inline-flex items-center gap-1 text-sm font-medium ${op.accent}`}
                  >
                    Iniciar emissão
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
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
