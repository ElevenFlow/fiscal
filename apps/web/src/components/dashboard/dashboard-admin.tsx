'use client';

import { emissoesPorDia30d, kpisAdmin, logs } from '@/lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Money } from '@nexo/ui';
import { Building2, DollarSign, FileText, Users } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { KpiCard } from './kpi-card';

const brandBlue = '#1E5FD8';

export function DashboardAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel do Administrador</h1>
        <p className="text-muted-foreground">Visão geral da plataforma Nexo Fiscal.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Contabilidades ativas"
          value={kpisAdmin.contabilidadesAtivas.toLocaleString('pt-BR')}
          icon={Building2}
          variation={4.2}
          hint="vs. 30d"
          tone="blue"
        />
        <KpiCard
          label="Empresas cadastradas"
          value={kpisAdmin.empresasCadastradas.toLocaleString('pt-BR')}
          icon={Users}
          variation={8.9}
          hint="vs. 30d"
          tone="green"
        />
        <KpiCard
          label="Notas emitidas (30d)"
          value={kpisAdmin.notas30d.toLocaleString('pt-BR')}
          icon={FileText}
          variation={12.4}
          hint="vs. mês anterior"
          tone="blue"
        />
        <KpiCard
          label="MRR"
          value={`R$ ${kpisAdmin.mrr.toLocaleString('pt-BR')}`}
          icon={DollarSign}
          variation={6.1}
          hint="mês atual"
          tone="green"
        />
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle>Emissões por dia</CardTitle>
          <CardDescription>Últimos 30 dias — todas as empresas.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={emissoesPorDia30d} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="notas"
                stroke={brandBlue}
                strokeWidth={2.5}
                dot={{ r: 3, fill: brandBlue }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Atividade recente */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
          <CardDescription>Ações executadas nas últimas horas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data/Hora</th>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                  <th className="px-4 py-3 font-semibold">Entidade</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{log.dataHora}</td>
                    <td className="px-4 py-3">{log.usuario}</td>
                    <td className="px-4 py-3">{log.acao}</td>
                    <td className="px-4 py-3 text-muted-foreground">{log.entidade}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {log.ip ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Faturamento da plataforma */}
      <Card>
        <CardHeader>
          <CardTitle>Receita recorrente</CardTitle>
          <CardDescription>Plano mensal consolidado.</CardDescription>
        </CardHeader>
        <CardContent>
          <Money value={kpisAdmin.mrr} className="text-3xl font-bold" />
          <p className="mt-1 text-sm text-muted-foreground">
            Projeção de crescimento: <span className="text-brand-green">+9% a.m.</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
