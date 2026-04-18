'use client';

import { alertas, faturamentoMensal6m, kpisEmpresa, notasFiscais } from '@/lib/mock-data';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Money,
  StatusPill,
  cn,
} from '@nexo/ui';
import {
  AlertTriangle,
  DollarSign,
  FilePlus,
  FileText,
  FileWarning,
  PackageMinus,
  Upload,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { KpiCard } from './kpi-card';

const brandBlue = '#1E5FD8';

export function DashboardEmpresa() {
  const ultimasNotas = notasFiscais.slice(0, 5);
  const alertasAtivos = alertas.filter((a) => !a.resolvido).slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel da Empresa</h1>
        <p className="text-muted-foreground">Emissão, faturamento e alertas em tempo real.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Notas emitidas (mês)"
          value={kpisEmpresa.notasMes.toLocaleString('pt-BR')}
          icon={FileText}
          variation={11.3}
          hint="vs. mês anterior"
          tone="blue"
        />
        <KpiCard
          label="Faturamento do mês"
          value={`R$ ${kpisEmpresa.faturamentoMes.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          icon={DollarSign}
          variation={4.8}
          hint="vs. mês anterior"
          tone="green"
        />
        <KpiCard
          label="Rejeitadas / pendentes"
          value={kpisEmpresa.rejeitadasPendentes.toLocaleString('pt-BR')}
          icon={FileWarning}
          tone="red"
        />
        <KpiCard
          label="Estoque crítico"
          value={kpisEmpresa.estoqueCritico.toLocaleString('pt-BR')}
          icon={PackageMinus}
          tone="amber"
        />
      </div>

      {/* Ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações rápidas</CardTitle>
          <CardDescription>Emita ou importe em um clique.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button className="gap-2">
            <FilePlus className="h-4 w-4" />
            Emitir NFS-e
          </Button>
          <Button className="gap-2">
            <FilePlus className="h-4 w-4" />
            Emitir NF-e
          </Button>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar XML
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Últimas notas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimas notas emitidas</CardTitle>
            <CardDescription>Visão rápida das emissões mais recentes.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Número</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasNotas.map((nota) => (
                    <tr key={nota.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-medium">{nota.numero}</div>
                        <div className="text-xs text-muted-foreground">
                          {nota.tipo} · {nota.data}
                        </div>
                      </td>
                      <td className="px-4 py-3">{nota.destinatarioNome}</td>
                      <td className="px-4 py-3 text-right">
                        <Money value={nota.valor} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={nota.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm">
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Alertas laterais */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>{alertasAtivos.length} ativos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertasAtivos.map((alerta) => (
              <div
                key={alerta.id}
                className={cn(
                  'flex gap-3 rounded-md border p-3 text-sm',
                  alerta.severidade === 'critico' && 'border-brand-danger/30 bg-brand-danger/5',
                  alerta.severidade === 'atencao' && 'border-brand-warning/30 bg-brand-warning/5',
                  alerta.severidade === 'info' && 'border-brand-blue/30 bg-brand-blue/5',
                )}
              >
                <AlertTriangle
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    alerta.severidade === 'critico' && 'text-brand-danger',
                    alerta.severidade === 'atencao' && 'text-brand-warning',
                    alerta.severidade === 'info' && 'text-brand-blue',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{alerta.titulo}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{alerta.descricao}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{alerta.data}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Faturamento 6 meses */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento — últimos 6 meses</CardTitle>
          <CardDescription>Somatório de NFS-e e NF-e autorizadas.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={faturamentoMensal6m}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={brandBlue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={brandBlue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v: number) => `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')}k`}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: 600 }}
                formatter={(value: number) => [
                  `R$ ${value.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                  'Faturamento',
                ]}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke={brandBlue}
                strokeWidth={2.5}
                fill="url(#gradFat)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
