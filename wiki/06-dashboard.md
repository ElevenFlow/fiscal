# 06 — Dashboard (visão geral)

## Visão geral

Página inicial pós-login. Mostra KPIs operacionais e fiscais com componentes diferenciados por papel:

- **Admin (plataforma)** — saúde global, MAU, tenants ativos, volume de documentos, incidentes.
- **Contabilidade** — empresas vinculadas, emissões do mês, importações pendentes, certificados a vencer.
- **Empresa** — NFS-e/NF-e do mês, faturamento, alertas críticos, documentos importados.

## Status atual

**Scaffolded.** Componentes esqueléticos prontos; sem queries de dados ainda.

| Componente | Status |
|-----------|--------|
| Roteamento `(app)/page.tsx` | Complete (placeholder) |
| `<DashboardAdmin>`, `<DashboardContabilidade>`, `<DashboardEmpresa>` | Esqueleto visual |
| `<KpiCard>` | Componente pronto |
| Endpoints backend para KPIs | **Não criados** |
| Queries Prisma (agregações) | **Não criadas** |
| Cache (Redis) | Planejado |

## Arquivos envolvidos

### Frontend (apps/web)
- `src/app/(app)/page.tsx` — entry point; resolve papel e renderiza dashboard apropriado
- `src/components/dashboard/dashboard-admin.tsx`
- `src/components/dashboard/dashboard-contabilidade.tsx`
- `src/components/dashboard/dashboard-empresa.tsx`
- `src/components/dashboard/kpi-card.tsx` — card de métrica reutilizável

### Backend (planejado)
- `apps/api/src/modules/dashboard/dashboard.module.ts`
- `apps/api/src/modules/dashboard/dashboard.controller.ts` — `GET /api/dashboard/kpis`
- `apps/api/src/modules/dashboard/dashboard.service.ts`

## KPIs por papel

### Admin
| KPI | Fonte |
|-----|-------|
| Tenants ativos | `count(empresas)` |
| MAU (Monthly Active Users) | distinct `user_id` em `audit_log` últimos 30d |
| Documentos emitidos (30d) | `count(nota_fiscal where created_at > now()-30d)` |
| Taxa de denegação (30d) | `count(result='denied') / count(*)` |
| Saúde SEFAZ por UF | snapshot do circuit breaker (Redis) |

### Contabilidade
| KPI | Fonte |
|-----|-------|
| Empresas ativas | `count(contabilidade_empresas where ativo)` |
| Emissões no mês | `count(nota_fiscal where empresa in [...] and month=current)` |
| Pendências (importações sem revisar) | `count(import_pendente)` |
| Certificados vencendo (30 dias) | `count(cert_a1 where expira_em < now()+30d)` |

### Empresa
| KPI | Fonte |
|-----|-------|
| NFS-e do mês | `count(nota_fiscal where tipo='nfse' and tenant=... and month=current)` |
| NF-e do mês | idem para `tipo='nfe'` |
| Faturamento do mês (NF-e) | `sum(valor_total)` |
| Alertas críticos | `count(alerta where severidade='critica' and lida=false)` |

## Padrão de implementação

### 1. Endpoint NestJS
```ts
@Controller('dashboard')
@UseGuards(ClerkGuard, RolesGuard)
export class DashboardController {
  @Get('kpis')
  @Roles('admin', 'contabilidade_owner', 'contabilidade_operador',
         'empresa_owner', 'empresa_operador', 'empresa_leitura')
  @Auditable({ action: 'dashboard.view' })
  getKpis(@Query() filter: KpiFilterDto) {
    return this.dashboard.computeFor(getTenantContext(), filter);
  }
}
```

### 2. Service com cache Redis
```ts
@Injectable()
export class DashboardService {
  async computeFor(ctx: TenantContext, filter: KpiFilterDto) {
    const cacheKey = `dashboard:${ctx.role}:${ctx.contabilidadeId}:${filter.empresaId}:${filter.month}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const kpis = await this.computeFresh(ctx, filter);
    await this.redis.setex(cacheKey, 60, JSON.stringify(kpis));  // TTL 60s
    return kpis;
  }
}
```

### 3. Frontend (TanStack Query)
```tsx
const { data } = useQuery({
  queryKey: ['dashboard', 'kpis', activeEmpresaId, currentMonth],
  queryFn: () => fetch('/api/dashboard/kpis?month=...').then(r => r.json()),
  staleTime: 60_000,
});
```

## Bibliotecas

| Pacote | Papel |
|--------|-------|
| `@tanstack/react-query` 5.x | Cache de dados no cliente |
| `recharts` 2.x | Gráficos (linha, barra, donut) |
| `date-fns` + `date-fns-tz` 4.x | Formatação BR + timezone `America/Sao_Paulo` |

## Padrões e ressalvas

- **Cache TTL curto** (60 s). KPIs não precisam de tempo real.
- **Agregações pesadas** rodam em job (BullMQ) com snapshot diário em tabela `dashboard_snapshot` — futuro.
- **Multi-empresa:** Contabilidade pode ter dezenas de empresas. Use `EmpresaSwitcher` (header) para focar uma; KPI agregado mostra "todas".
- **Recharts** evita lock-in; se preciso de mais sofisticação visual, considere Tremor.
- **Skeletons obrigatórios** durante loading — TanStack Query suspense.

## Próximos passos

- [ ] Criar módulo `dashboard` no NestJS
- [ ] Definir DTO `KpiFilterDto` com Zod
- [ ] Implementar `DashboardService` (queries + cache)
- [ ] Tabela `dashboard_snapshot` para histórico (gráficos de tendência)
- [ ] Filtros: período (mês/trimestre/ano), tipo de documento, empresa
- [ ] Drilldown: clicar em "12 NFS-e canceladas" abre lista filtrada em [08-documentos.md](08-documentos.md)
