'use client';

import { type Alerta, empresas, alertas as fixtureAlertas } from '@/lib/mock-data';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator, cn } from '@nexo/ui';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  CircleCheckBig,
  Info,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Severidade = Alerta['severidade'];
type Periodo = 'hoje' | '7d' | '30d' | 'tudo';
type StatusFiltro = 'aberto' | 'resolvido' | 'todos';

const TIPOS_ALERTA = [
  'Certificado',
  'Nota rejeitada',
  'Estoque mínimo',
  'Nota pendente',
  'Cadastro duplicado',
  'Login suspeito',
] as const;

type TipoAlerta = (typeof TIPOS_ALERTA)[number];

interface AlertaEstendido extends Alerta {
  tipo: TipoAlerta;
  acao?: 'renovar-certificado' | 'corrigir-nota' | 'ver-produto' | 'generico';
  destinoAcao?: string;
}

// Derive tipo from existing fixture + adiciona mais entries variados.
const TIPOS_POR_ID: Record<
  string,
  { tipo: TipoAlerta; acao: AlertaEstendido['acao']; destinoAcao?: string }
> = {
  'al-1': { tipo: 'Certificado', acao: 'renovar-certificado' },
  'al-2': { tipo: 'Nota rejeitada', acao: 'corrigir-nota', destinoAcao: '/emitir/nfs-e' },
  'al-3': { tipo: 'Estoque mínimo', acao: 'ver-produto', destinoAcao: '/cadastros/produtos' },
  'al-4': { tipo: 'Certificado', acao: 'renovar-certificado' },
  'al-5': { tipo: 'Nota pendente', acao: 'generico' },
};

const ALERTAS_MOCK: AlertaEstendido[] = [
  ...fixtureAlertas.map((a) => ({
    ...a,
    tipo: TIPOS_POR_ID[a.id]?.tipo ?? 'Nota pendente',
    acao: TIPOS_POR_ID[a.id]?.acao ?? 'generico',
    destinoAcao: TIPOS_POR_ID[a.id]?.destinoAcao,
  })),
  {
    id: 'al-6',
    severidade: 'atencao',
    tipo: 'Nota rejeitada',
    titulo: 'NF-e 001245 em processamento há 15 min',
    descricao: 'Aguardando resposta da SEFAZ-SP. Retentar em caso de timeout.',
    empresa: 'Oliveira Tech',
    data: '18/04/2026 09:02',
    resolvido: false,
    acao: 'corrigir-nota',
    destinoAcao: '/emitir/nf-e',
  },
  {
    id: 'al-7',
    severidade: 'critico',
    tipo: 'Estoque mínimo',
    titulo: 'Disjuntor 20A Curva C abaixo do mínimo',
    descricao: 'Saldo atual 4 un, mínimo 10 un. Emissão pode bloquear.',
    empresa: 'Oliveira Tech',
    data: '18/04/2026 08:42',
    resolvido: false,
    acao: 'ver-produto',
    destinoAcao: '/cadastros/produtos',
  },
  {
    id: 'al-8',
    severidade: 'info',
    tipo: 'Cadastro duplicado',
    titulo: 'Cliente duplicado detectado',
    descricao: 'CNPJ 19.876.543/0001-55 aparece em 2 cadastros. Revise para consolidar.',
    empresa: 'Oliveira Tech',
    data: '17/04/2026 16:30',
    resolvido: false,
    acao: 'generico',
  },
  {
    id: 'al-9',
    severidade: 'atencao',
    tipo: 'Login suspeito',
    titulo: 'Acesso de IP incomum',
    descricao: 'Login de 177.22.33.44 (Campinas-SP) fora do padrão do usuário.',
    empresa: 'Alfa Assessoria Contábil',
    data: '17/04/2026 23:12',
    resolvido: false,
    acao: 'generico',
  },
  {
    id: 'al-10',
    severidade: 'critico',
    tipo: 'Certificado',
    titulo: 'Certificado digital vencido',
    descricao: 'Solar Engenharia — venceu em 10/04/2026. Emissão bloqueada.',
    empresa: 'Solar Engenharia',
    data: '11/04/2026 00:00',
    resolvido: false,
    acao: 'renovar-certificado',
  },
  {
    id: 'al-11',
    severidade: 'atencao',
    tipo: 'Nota pendente',
    titulo: 'NF-e 001241 aguardando destinatário',
    descricao: 'Destinatário não recebeu o e-mail de envio. Reenvie manualmente.',
    empresa: 'Oliveira Tech',
    data: '16/04/2026 11:22',
    resolvido: false,
    acao: 'generico',
  },
  {
    id: 'al-12',
    severidade: 'info',
    tipo: 'Cadastro duplicado',
    titulo: 'Produto com SKU duplicado',
    descricao: 'Dois produtos com SKU "TEC-USB-BR01". Revise o catálogo.',
    empresa: 'Oliveira Tech',
    data: '15/04/2026 09:15',
    resolvido: true,
    acao: 'ver-produto',
    destinoAcao: '/cadastros/produtos',
  },
  {
    id: 'al-13',
    severidade: 'info',
    tipo: 'Nota pendente',
    titulo: '3 notas em rascunho há mais de 7 dias',
    descricao: 'Rascunhos antigos acumulam atenção. Revise ou descarte.',
    empresa: 'Clínica Vida Integral',
    data: '14/04/2026 14:00',
    resolvido: true,
    acao: 'generico',
  },
  {
    id: 'al-14',
    severidade: 'atencao',
    tipo: 'Login suspeito',
    titulo: 'Tentativa de login falhou 3x',
    descricao: 'Usuário lucas@paodourado.com.br — IP 200.171.88.12.',
    empresa: 'Padaria Pão Dourado',
    data: '13/04/2026 18:44',
    resolvido: true,
    acao: 'generico',
  },
  {
    id: 'al-15',
    severidade: 'info',
    tipo: 'Nota rejeitada',
    titulo: 'NF-e 001240 autorizada após 2ª tentativa',
    descricao: 'Falha inicial por timeout SEFAZ resolvida no retry automático.',
    empresa: 'Oliveira Tech',
    data: '12/04/2026 10:08',
    resolvido: true,
    acao: 'generico',
  },
];

const SEVERIDADES: Array<{ value: Severidade; label: string; dot: string; text: string }> = [
  { value: 'critico', label: 'Crítico', dot: 'bg-brand-danger', text: 'text-brand-danger' },
  { value: 'atencao', label: 'Atenção', dot: 'bg-brand-warning', text: 'text-brand-warning' },
  { value: 'info', label: 'Informativo', dot: 'bg-brand-blue', text: 'text-brand-blue' },
];

function timeAgo(data: string): string {
  // data: DD/MM/AAAA HH:mm
  const [d, m, rest] = data.split('/');
  const [y, hm] = (rest ?? '').split(' ');
  const [hh, mm] = (hm ?? '00:00').split(':');
  const alertDate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
  const now = new Date('2026-04-18T10:00:00');
  const diffMin = Math.max(1, Math.floor((now.getTime() - alertDate.getTime()) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD} dia${diffD === 1 ? '' : 's'}`;
  return data.split(' ')[0] ?? data;
}

function severityBorderColor(sev: Severidade): string {
  if (sev === 'critico') return 'border-l-brand-danger';
  if (sev === 'atencao') return 'border-l-brand-warning';
  return 'border-l-brand-blue';
}

function SeverityIcon({ sev }: { sev: Severidade }) {
  if (sev === 'critico') {
    return <AlertTriangle className="h-6 w-6 text-brand-danger" aria-hidden />;
  }
  if (sev === 'atencao') {
    return <AlertCircle className="h-6 w-6 text-brand-warning" aria-hidden />;
  }
  return <Info className="h-6 w-6 text-brand-blue" aria-hidden />;
}

function FilterGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b py-3 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {title}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-3 space-y-2">{children}</div> : null}
    </div>
  );
}

function CheckItem({
  checked,
  onChange,
  label,
  dot,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  dot?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-brand-blue"
      />
      {dot ? <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden /> : null}
      <span className="flex-1">{label}</span>
    </label>
  );
}

function DonutChart({
  data,
}: {
  data: Array<{ label: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Sem dados
      </div>
    );
  }
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 120 120"
        className="h-28 w-28 -rotate-90"
        role="img"
        aria-label="Distribuição por severidade"
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="14"
        />
        {data.map((d) => {
          const fraction = d.value / total;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={d.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: d.color }} aria-hidden />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-semibold tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AlertasClient() {
  const router = useRouter();
  const [rows, setRows] = useState<AlertaEstendido[]>(ALERTAS_MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filtros
  const [sevSet, setSevSet] = useState<Set<Severidade>>(new Set());
  const [tipoSet, setTipoSet] = useState<Set<TipoAlerta>>(new Set());
  const [empresaSet, setEmpresaSet] = useState<Set<string>>(new Set());
  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('aberto');

  const toggleSet = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const filtered = useMemo(() => {
    return rows.filter((a) => {
      if (sevSet.size > 0 && !sevSet.has(a.severidade)) return false;
      if (tipoSet.size > 0 && !tipoSet.has(a.tipo)) return false;
      if (empresaSet.size > 0 && (!a.empresa || !empresaSet.has(a.empresa))) return false;
      if (statusFiltro === 'aberto' && a.resolvido) return false;
      if (statusFiltro === 'resolvido' && !a.resolvido) return false;
      if (periodo !== 'tudo') {
        const [d, m, rest] = a.data.split('/');
        const [y] = (rest ?? '').split(' ');
        const ad = new Date(Number(y), Number(m) - 1, Number(d));
        const now = new Date('2026-04-18T00:00:00');
        const diffDays = (now.getTime() - ad.getTime()) / (1000 * 60 * 60 * 24);
        if (periodo === 'hoje' && diffDays > 0) return false;
        if (periodo === '7d' && diffDays > 7) return false;
        if (periodo === '30d' && diffDays > 30) return false;
      }
      return true;
    });
  }, [rows, sevSet, tipoSet, empresaSet, periodo, statusFiltro]);

  const abertos = rows.filter((a) => !a.resolvido).length;
  const resolvidosHoje = rows.filter((a) => a.resolvido && a.data.startsWith('17/04/2026')).length;

  const porSeveridade = [
    {
      label: 'Crítico',
      value: rows.filter((a) => a.severidade === 'critico' && !a.resolvido).length,
      color: '#E54848',
    },
    {
      label: 'Atenção',
      value: rows.filter((a) => a.severidade === 'atencao' && !a.resolvido).length,
      color: '#E89B2E',
    },
    {
      label: 'Info',
      value: rows.filter((a) => a.severidade === 'info' && !a.resolvido).length,
      color: '#1E5FD8',
    },
  ];

  const total7d = rows.filter((a) => {
    const [d, m, rest] = a.data.split('/');
    const [y] = (rest ?? '').split(' ');
    const ad = new Date(Number(y), Number(m) - 1, Number(d));
    const now = new Date('2026-04-18T00:00:00');
    return (now.getTime() - ad.getTime()) / (1000 * 60 * 60 * 24) <= 7;
  }).length;
  const resolv7d = rows.filter((a) => {
    const [d, m, rest] = a.data.split('/');
    const [y] = (rest ?? '').split(' ');
    const ad = new Date(Number(y), Number(m) - 1, Number(d));
    const now = new Date('2026-04-18T00:00:00');
    const inRange = (now.getTime() - ad.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    return inRange && a.resolvido;
  }).length;
  const pctResolv = total7d === 0 ? 0 : Math.round((resolv7d / total7d) * 100);

  const clearFilters = () => {
    setSevSet(new Set());
    setTipoSet(new Set());
    setEmpresaSet(new Set());
    setPeriodo('tudo');
    setStatusFiltro('aberto');
  };

  const resolver = (id: string, nome: string) => {
    setRows((prev) => prev.map((a) => (a.id === id ? { ...a, resolvido: true } : a)));
    toast.success(`Alerta "${nome}" marcado como resolvido`);
  };

  const marcarTodosLidos = () => {
    setRows((prev) => prev.map((a) => ({ ...a, resolvido: true })));
    toast.success('Todos os alertas marcados como lidos');
  };

  const executarAcao = (a: AlertaEstendido) => {
    if (a.acao === 'renovar-certificado') {
      toast.info('Abrindo fluxo de renovação de certificado (mock)');
      return;
    }
    if (a.acao === 'corrigir-nota' && a.destinoAcao) {
      router.push(a.destinoAcao);
      return;
    }
    if (a.acao === 'ver-produto' && a.destinoAcao) {
      router.push(a.destinoAcao);
      return;
    }
    resolver(a.id, a.titulo);
  };

  const empresasDisponiveis = Array.from(
    new Set(rows.map((a) => a.empresa).filter(Boolean) as string[]),
  );
  // Inclui fixtures principais mesmo se não apareceram em alertas.
  for (const e of empresas) {
    if (!empresasDisponiveis.includes(e.nomeFantasia)) {
      empresasDisponiveis.push(e.nomeFantasia);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alertas e Pendências</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{abertos}</span> abertos ·{' '}
            <span className="font-semibold text-foreground">{resolvidosHoje}</span> resolvidos hoje
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={marcarTodosLidos}>
            <Check className="mr-2 h-4 w-4" />
            Marcar todos como lidos
          </Button>
          <Button variant="ghost" onClick={() => toast.info('Configuração de regras (mock)')}>
            <Settings2 className="mr-2 h-4 w-4" />
            Configurar regras
          </Button>
        </div>
      </div>

      {/* 3 colunas em desktop */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Coluna esquerda — Filtros */}
        <aside className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Filtros</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" />
                Limpar
              </Button>
            </div>
            <Separator className="my-3" />
            <div className="divide-y">
              <FilterGroup title="Severidade">
                {SEVERIDADES.map((s) => (
                  <CheckItem
                    key={s.value}
                    checked={sevSet.has(s.value)}
                    onChange={() => setSevSet((prev) => toggleSet(prev, s.value))}
                    label={s.label}
                    dot={s.dot}
                  />
                ))}
              </FilterGroup>
              <FilterGroup title="Tipo">
                {TIPOS_ALERTA.map((t) => (
                  <CheckItem
                    key={t}
                    checked={tipoSet.has(t)}
                    onChange={() => setTipoSet((prev) => toggleSet(prev, t))}
                    label={t}
                  />
                ))}
              </FilterGroup>
              <FilterGroup title="Empresa" defaultOpen={false}>
                <div className="max-h-40 overflow-y-auto">
                  {empresasDisponiveis.map((e) => (
                    <CheckItem
                      key={e}
                      checked={empresaSet.has(e)}
                      onChange={() => setEmpresaSet((prev) => toggleSet(prev, e))}
                      label={e}
                    />
                  ))}
                </div>
              </FilterGroup>
              <FilterGroup title="Período">
                {[
                  { v: 'hoje' as const, l: 'Hoje' },
                  { v: '7d' as const, l: 'Últimos 7 dias' },
                  { v: '30d' as const, l: 'Últimos 30 dias' },
                  { v: 'tudo' as const, l: 'Tudo' },
                ].map((opt) => (
                  <label key={opt.v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="periodo"
                      checked={periodo === opt.v}
                      onChange={() => setPeriodo(opt.v)}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    {opt.l}
                  </label>
                ))}
              </FilterGroup>
              <FilterGroup title="Status">
                {[
                  { v: 'aberto' as const, l: 'Abertos' },
                  { v: 'resolvido' as const, l: 'Resolvidos' },
                  { v: 'todos' as const, l: 'Todos' },
                ].map((opt) => (
                  <label key={opt.v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="status"
                      checked={statusFiltro === opt.v}
                      onChange={() => setStatusFiltro(opt.v)}
                      className="h-4 w-4 accent-brand-blue"
                    />
                    {opt.l}
                  </label>
                ))}
              </FilterGroup>
            </div>
          </Card>
        </aside>

        {/* Coluna central — Lista */}
        <section>
          {filtered.length === 0 ? (
            <Card className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10">
                <CircleCheckBig className="h-7 w-7 text-brand-green" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">Tudo em ordem!</h3>
              <p className="mb-4 mt-1 max-w-sm text-sm text-muted-foreground">
                Você não tem pendências nesse filtro. Experimente ajustar os critérios.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </Card>
          ) : (
            <ul className="space-y-3">
              {filtered.map((a) => {
                const isExpanded = expanded === a.id;
                return (
                  <li key={a.id}>
                    <Card
                      className={cn(
                        'group cursor-pointer border-l-4 p-4 transition-all hover:shadow-md',
                        severityBorderColor(a.severidade),
                        a.resolvido && 'opacity-70',
                      )}
                      onClick={() => setExpanded(isExpanded ? null : a.id)}
                    >
                      <div className="flex items-start gap-3">
                        <SeverityIcon sev={a.severidade} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold leading-tight">{a.titulo}</h3>
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {a.descricao}
                              </p>
                            </div>
                            <Badge
                              variant={a.resolvido ? 'secondary' : 'warning'}
                              className={cn('shrink-0', a.resolvido && 'bg-muted text-foreground')}
                            >
                              {a.resolvido ? 'Resolvido' : 'Aberto'}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            {a.empresa ? <span>{a.empresa}</span> : null}
                            {a.empresa ? <span aria-hidden>·</span> : null}
                            <span>{timeAgo(a.data)}</span>
                            <span aria-hidden>·</span>
                            <span className="font-medium">{a.tipo}</span>
                          </div>

                          {isExpanded ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                              {!a.resolvido ? (
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    executarAcao(a);
                                  }}
                                >
                                  {a.acao === 'renovar-certificado' && 'Renovar certificado'}
                                  {a.acao === 'corrigir-nota' && 'Corrigir nota'}
                                  {a.acao === 'ver-produto' && 'Ver produto'}
                                  {(a.acao === 'generico' || !a.acao) && 'Marcar como resolvido'}
                                </Button>
                              ) : null}
                              {!a.resolvido && a.acao !== 'generico' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resolver(a.id, a.titulo);
                                  }}
                                >
                                  Marcar como resolvido
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpanded(null);
                                }}
                              >
                                Fechar
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Coluna direita — Resumo */}
        <aside className="space-y-4 lg:block">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Últimos 7 dias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div>
                <div className="text-3xl font-bold tabular-nums">{total7d}</div>
                <div className="text-xs text-muted-foreground">alertas gerados</div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Resolvidos</span>
                  <span className="font-semibold">{pctResolv}%</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-brand-green transition-all"
                    style={{ width: `${pctResolv}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Por severidade</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <DonutChart data={porSeveridade} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-brand-blue" aria-hidden />
                Ações sugeridas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-warning" aria-hidden />
                  <span>
                    Renove certificados de <strong>2 empresas</strong> antes do vencimento.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-danger" aria-hidden />
                  <span>
                    Corrija <strong>2 notas</strong> rejeitadas pendentes há mais de 2 dias.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
                  <span>
                    Reponha estoque de <strong>3 produtos</strong> abaixo do mínimo.
                  </span>
                </li>
                <li className="flex gap-2">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>Consolide cadastros duplicados detectados.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
