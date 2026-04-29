'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator, cn } from '@nexo/ui';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CircleCheckBig,
  Info,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Severidade = 'critico' | 'atencao' | 'info';
type TipoAlerta = 'certificado' | 'documento' | 'estoque';
type StatusFiltro = 'aberto' | 'resolvido' | 'todos';

type Alerta = {
  id: string;
  tipo: TipoAlerta;
  severidade: Severidade;
  titulo: string;
  descricao: string;
  destinoAcao: string;
  createdAt: string;
  resolvido: boolean;
};

const SEVERIDADES: Array<{ value: Severidade; label: string; dot: string }> = [
  { value: 'critico', label: 'Crítico', dot: 'bg-brand-danger' },
  { value: 'atencao', label: 'Atenção', dot: 'bg-brand-warning' },
  { value: 'info', label: 'Informativo', dot: 'bg-brand-blue' },
];

const TIPOS: Array<{ value: TipoAlerta; label: string }> = [
  { value: 'certificado', label: 'Certificado' },
  { value: 'documento', label: 'Documento fiscal' },
  { value: 'estoque', label: 'Estoque mínimo' },
];

function severityBorderColor(sev: Severidade): string {
  if (sev === 'critico') return 'border-l-brand-danger';
  if (sev === 'atencao') return 'border-l-brand-warning';
  return 'border-l-brand-blue';
}

function SeverityIcon({ sev }: { sev: Severidade }) {
  if (sev === 'critico') return <AlertTriangle className="h-6 w-6 text-brand-danger" aria-hidden />;
  if (sev === 'atencao') return <AlertCircle className="h-6 w-6 text-brand-warning" aria-hidden />;
  return <Info className="h-6 w-6 text-brand-blue" aria-hidden />;
}

function tipoLabel(tipo: TipoAlerta): string {
  return TIPOS.find((item) => item.value === tipo)?.label ?? tipo;
}

function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMin = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD} dia${diffD === 1 ? '' : 's'}`;
  return date.toLocaleDateString('pt-BR');
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

export function AlertasClient() {
  const router = useRouter();
  const [rows, setRows] = useState<Alerta[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [severidade, setSeveridade] = useState<Set<Severidade>>(new Set());
  const [tipo, setTipo] = useState<Set<TipoAlerta>>(new Set());
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('aberto');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('status', statusFiltro);
      const severidadeUnica = Array.from(severidade)[0];
      const tipoUnico = Array.from(tipo)[0];
      if (severidade.size === 1 && severidadeUnica) qs.set('severidade', severidadeUnica);
      if (tipo.size === 1 && tipoUnico) qs.set('tipo', tipoUnico);
      const res = await fetch(`/api/alertas?${qs.toString()}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar alertas');
      setRows(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar alertas');
    } finally {
      setLoading(false);
    }
  }, [severidade, statusFiltro, tipo]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSet = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const resumo = useMemo(
    () => ({
      abertos: rows.filter((a) => !a.resolvido).length,
      criticos: rows.filter((a) => !a.resolvido && a.severidade === 'critico').length,
      atencao: rows.filter((a) => !a.resolvido && a.severidade === 'atencao').length,
      info: rows.filter((a) => !a.resolvido && a.severidade === 'info').length,
    }),
    [rows],
  );

  const clearFilters = () => {
    setSeveridade(new Set());
    setTipo(new Set());
    setStatusFiltro('aberto');
  };

  const resolver = async (alerta: Alerta) => {
    const res = await fetch(`/api/alertas/${encodeURIComponent(alerta.id)}/resolver`, {
      method: 'POST',
    });
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload?.message ?? 'Falha ao resolver alerta');
      return;
    }
    setRows((prev) =>
      prev.map((item) => (item.id === alerta.id ? { ...item, resolvido: true } : item)),
    );
    toast.success(
      payload.persistido === false
        ? 'Alerta marcado nesta sessão; persistência ficou em pendências.'
        : 'Alerta resolvido.',
    );
  };

  const executarAcao = (alerta: Alerta) => {
    if (alerta.destinoAcao) {
      router.push(alerta.destinoAcao);
      return;
    }
    void resolver(alerta);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alertas e Pendências</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{resumo.abertos}</span> abertos ·{' '}
            <span className="font-semibold text-brand-danger">{resumo.criticos}</span> críticos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </Button>
          <Button
            variant="ghost"
            onClick={() => toast.info('Regras personalizadas ficaram em pendências de hardening.')}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Regras
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_300px]">
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
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Severidade
                </div>
                {SEVERIDADES.map((s) => (
                  <CheckItem
                    key={s.value}
                    checked={severidade.has(s.value)}
                    onChange={() => setSeveridade((prev) => toggleSet(prev, s.value))}
                    label={s.label}
                    dot={s.dot}
                  />
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Tipo</div>
                {TIPOS.map((item) => (
                  <CheckItem
                    key={item.value}
                    checked={tipo.has(item.value)}
                    onChange={() => setTipo((prev) => toggleSet(prev, item.value))}
                    label={item.label}
                  />
                ))}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Status</div>
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
              </div>
            </div>
          </Card>
        </aside>

        <section>
          {rows.length === 0 ? (
            <Card className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/10">
                <CircleCheckBig className="h-7 w-7 text-brand-green" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">Tudo em ordem</h3>
              <p className="mb-4 mt-1 max-w-sm text-sm text-muted-foreground">
                Não há pendências para os filtros selecionados.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </Card>
          ) : (
            <ul className="space-y-3">
              {rows.map((alerta) => {
                const isExpanded = expanded === alerta.id;
                return (
                  <li key={alerta.id}>
                    <Card
                      className={cn(
                        'cursor-pointer border-l-4 p-4 transition-all hover:shadow-md',
                        severityBorderColor(alerta.severidade),
                        alerta.resolvido && 'opacity-70',
                      )}
                      onClick={() => setExpanded(isExpanded ? null : alerta.id)}
                    >
                      <div className="flex items-start gap-3">
                        <SeverityIcon sev={alerta.severidade} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold leading-tight">{alerta.titulo}</h3>
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {alerta.descricao}
                              </p>
                            </div>
                            <Badge
                              variant={alerta.resolvido ? 'secondary' : 'warning'}
                              className="shrink-0"
                            >
                              {alerta.resolvido ? 'Resolvido' : 'Aberto'}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>{timeAgo(alerta.createdAt)}</span>
                            <span aria-hidden>·</span>
                            <span className="font-medium">{tipoLabel(alerta.tipo)}</span>
                          </div>

                          {isExpanded ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                              {!alerta.resolvido ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      executarAcao(alerta);
                                    }}
                                  >
                                    Ver origem
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void resolver(alerta);
                                    }}
                                  >
                                    <Check className="mr-2 h-4 w-4" />
                                    Resolver
                                  </Button>
                                </>
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

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribuição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2 text-sm">
              {SEVERIDADES.map((item) => (
                <div key={item.value} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={cn('h-2 w-2 rounded-full', item.dot)} aria-hidden />
                    {item.label}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {item.value === 'critico'
                      ? resumo.criticos
                      : item.value === 'atencao'
                        ? resumo.atencao
                        : resumo.info}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4 text-brand-blue" aria-hidden />
                Sinal em tempo real
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 text-sm text-muted-foreground">
              A tela já usa dados da API. Indicador SSE por tenant ficou registrado em pendências
              para ser ligado com a infra definitiva.
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
