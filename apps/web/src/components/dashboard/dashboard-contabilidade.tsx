'use client';

import { alertas, emissoesPorEmpresa, empresas, kpisContabilidade } from '@/lib/mock-data';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nexo/ui';
import { AlertTriangle, Building2, Clock, FileCheck2, ShieldAlert } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KpiCard } from './kpi-card';

const brandBlue = '#1E5FD8';

export function DashboardContabilidade() {
  const empresasAtencao = empresas.filter(
    (e) => e.status !== 'ativa' || e.id === 'e-1' || e.id === 'e-2',
  );
  const alertasCriticos = alertas.filter((a) => !a.resolvido);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel da Contabilidade</h1>
        <p className="text-muted-foreground">Sua carteira de empresas e pendências do dia.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Empresas na carteira"
          value={kpisContabilidade.empresasCarteira.toLocaleString('pt-BR')}
          icon={Building2}
          tone="blue"
        />
        <KpiCard
          label="Notas hoje"
          value={kpisContabilidade.notasHoje.toLocaleString('pt-BR')}
          icon={FileCheck2}
          variation={9.1}
          hint="vs. ontem"
          tone="green"
        />
        <KpiCard
          label="Pendências ativas"
          value={kpisContabilidade.pendenciasAtivas.toLocaleString('pt-BR')}
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiCard
          label="Certificados vencendo"
          value={kpisContabilidade.certsVencendo.toLocaleString('pt-BR')}
          icon={ShieldAlert}
          tone="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Empresas que precisam atenção */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Empresas que precisam de atenção</CardTitle>
            <CardDescription>Priorize pelos alertas ativos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {empresasAtencao.slice(0, 5).map((empresa) => {
              const alertasEmpresa = alertasCriticos.filter(
                (a) => a.empresa && empresa.nomeFantasia.includes(a.empresa),
              );
              const severidade = alertasEmpresa.some((a) => a.severidade === 'critico')
                ? 'critico'
                : alertasEmpresa.some((a) => a.severidade === 'atencao')
                  ? 'atencao'
                  : 'info';
              const badgeVariant =
                severidade === 'critico'
                  ? 'destructive'
                  : severidade === 'atencao'
                    ? 'warning'
                    : 'secondary';
              const labelAlerta =
                alertasEmpresa[0]?.titulo ??
                (empresa.status === 'pendente' ? 'Cadastro pendente' : 'Acompanhamento rotineiro');

              return (
                <div
                  key={empresa.id}
                  className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{empresa.nomeFantasia}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {empresa.cidade}/{empresa.uf} · {empresa.regime}
                    </div>
                  </div>
                  <Badge variant={badgeVariant} className="whitespace-nowrap">
                    {labelAlerta}
                  </Badge>
                  <Button size="sm" variant="outline">
                    Abrir
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Resumo de pendências */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo de pendências</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-md bg-brand-danger/10 p-3">
              <div className="flex items-center gap-2 font-medium text-brand-danger">
                <ShieldAlert className="h-4 w-4" />
                Rejeições abertas
              </div>
              <span className="font-mono text-lg font-bold text-brand-danger">3</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-brand-warning/10 p-3">
              <div className="flex items-center gap-2 font-medium text-brand-warning">
                <Clock className="h-4 w-4" />
                Cadastros incompletos
              </div>
              <span className="font-mono text-lg font-bold text-brand-warning">5</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-brand-blue/10 p-3">
              <div className="flex items-center gap-2 font-medium text-brand-blue">
                <FileCheck2 className="h-4 w-4" />
                XMLs aguardando revisão
              </div>
              <span className="font-mono text-lg font-bold text-brand-blue">12</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emissões por empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Emissões por empresa</CardTitle>
          <CardDescription>Top da carteira no mês corrente.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={emissoesPorEmpresa} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
              <XAxis dataKey="empresa" stroke="hsl(var(--muted-foreground))" fontSize={11} />
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
              <Bar dataKey="notas" fill={brandBlue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
