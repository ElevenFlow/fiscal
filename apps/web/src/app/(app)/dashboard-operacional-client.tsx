'use client';

import { KpiCard } from '@/components/dashboard/kpi-card';
import type { Role } from '@/lib/mock-data';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Money,
  StatusPill,
} from '@nexo/ui';
import {
  AlertTriangle,
  Building2,
  FileText,
  PackageOpen,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Documento = {
  id: string;
  modeloLabel: string;
  numero: string | null;
  status: string;
  statusLabel: string;
  participanteNome: string | null;
  valorTotal: number;
  createdAt: string;
};

type DashboardData = {
  admin: {
    empresas: number;
    documentosMes: number;
    alertasCriticos: number;
    atividadeRecente: Documento[];
  };
  contabilidade: {
    empresas: number;
    notasHoje: number;
    pendenciasAtivas: number;
    certificadosVencendo: number;
    empresasAtencao: Array<{ empresa: string; criticos: number; atencao: number }>;
  };
  empresa: {
    notasMes: number;
    faturamentoMes: number;
    rejeitadasPendentes: number;
    estoqueCritico: number;
    ultimasNotas: Documento[];
    ultimasMovimentacoes: Array<{
      id: string;
      produto: string;
      tipo: string;
      quantidade: number;
      createdAt: string;
    }>;
  };
};

const STATUS_TO_PILL: Record<
  string,
  'autorizada' | 'rejeitada' | 'cancelada' | 'pendente' | 'processando' | 'rascunho'
> = {
  AUTHORIZED: 'autorizada',
  CANCELLED: 'cancelada',
  REJECTED: 'rejeitada',
  PENDING_RESPONSE: 'pendente',
  TRANSMITTING: 'processando',
  SIGNING: 'processando',
  DRAFT: 'rascunho',
};

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function RecentDocuments({ rows }: { rows: Documento[] }) {
  if (rows.length === 0) return <EmptyState label="Nenhum documento recente." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Documento</th>
            <th className="py-2 font-medium">Participante</th>
            <th className="py-2 text-right font-medium">Valor</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((doc) => (
            <tr key={doc.id} className="border-t">
              <td className="py-3">
                <div className="font-medium">{doc.modeloLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {doc.numero ?? doc.id.slice(0, 8)} · {formatDate(doc.createdAt)}
                </div>
              </td>
              <td className="py-3 text-muted-foreground">{doc.participanteNome ?? '-'}</td>
              <td className="py-3 text-right">
                <Money value={doc.valorTotal} />
              </td>
              <td className="py-3">
                <StatusPill
                  status={STATUS_TO_PILL[doc.status] ?? 'rascunho'}
                  label={doc.statusLabel}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardOperacionalClient({ role }: { role: Role }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar dashboard');
      setData(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const title = useMemo(() => {
    if (role === 'admin') return 'Painel Nexo Fiscal';
    if (role === 'contabilidade') return 'Painel da contabilidade';
    return 'Painel da empresa';
  }, [role]);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Carregando
          </Button>
        </div>
        <EmptyState label="Carregando indicadores operacionais." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">
            Indicadores consolidados de documentos, alertas e estoque.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Atualizar
        </Button>
      </div>

      {role === 'admin' ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Empresas ativas"
              value={formatNumber(data.admin.empresas)}
              icon={Building2}
              tone="blue"
            />
            <KpiCard
              label="Documentos no mês"
              value={formatNumber(data.admin.documentosMes)}
              icon={FileText}
              tone="green"
            />
            <KpiCard
              label="Alertas críticos"
              value={formatNumber(data.admin.alertasCriticos)}
              icon={AlertTriangle}
              tone="red"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Atividade recente</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentDocuments rows={data.admin.atividadeRecente} />
            </CardContent>
          </Card>
        </>
      ) : null}

      {role === 'contabilidade' ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Empresas"
              value={formatNumber(data.contabilidade.empresas)}
              icon={Building2}
              tone="blue"
            />
            <KpiCard
              label="Notas hoje"
              value={formatNumber(data.contabilidade.notasHoje)}
              icon={FileText}
              tone="green"
            />
            <KpiCard
              label="Pendências"
              value={formatNumber(data.contabilidade.pendenciasAtivas)}
              icon={AlertTriangle}
              tone="amber"
            />
            <KpiCard
              label="Certificados"
              value={formatNumber(data.contabilidade.certificadosVencendo)}
              icon={TrendingUp}
              tone="red"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Empresas que exigem atenção</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.contabilidade.empresasAtencao.length === 0 ? (
                <EmptyState label="Nenhuma empresa com alerta aberto." />
              ) : null}
              {data.contabilidade.empresasAtencao.map((empresa) => (
                <div
                  key={empresa.empresa}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="font-medium">{empresa.empresa}</div>
                  <div className="flex gap-2">
                    <Badge variant="destructive">{empresa.criticos} críticos</Badge>
                    <Badge variant="warning">{empresa.atencao} atenção</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      {role === 'empresa' ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard
              label="Notas no mês"
              value={formatNumber(data.empresa.notasMes)}
              icon={FileText}
              tone="blue"
            />
            <KpiCard
              label="Faturamento"
              value={data.empresa.faturamentoMes.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              icon={TrendingUp}
              tone="green"
            />
            <KpiCard
              label="Rejeitadas"
              value={formatNumber(data.empresa.rejeitadasPendentes)}
              icon={AlertTriangle}
              tone="red"
            />
            <KpiCard
              label="Estoque crítico"
              value={formatNumber(data.empresa.estoqueCritico)}
              icon={PackageOpen}
              tone="amber"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Últimas notas</CardTitle>
              </CardHeader>
              <CardContent>
                <RecentDocuments rows={data.empresa.ultimasNotas} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Movimentações recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.empresa.ultimasMovimentacoes.length === 0 ? (
                  <EmptyState label="Nenhuma movimentação recente." />
                ) : null}
                {data.empresa.ultimasMovimentacoes.slice(0, 8).map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{mov.produto}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(mov.createdAt)}
                      </div>
                    </div>
                    <Badge variant="secondary">{mov.quantidade.toLocaleString('pt-BR')}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
