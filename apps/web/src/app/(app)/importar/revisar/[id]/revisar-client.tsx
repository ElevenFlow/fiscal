'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Money,
  cn,
} from '@nexo/ui';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Vinculo = 'match' | 'novo' | 'ignorar';

interface ProdutoOption {
  id: string;
  codigo: string;
  descricao: string;
}

interface ItemXml {
  id: string;
  codigoFornecedor: string;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
  sugestaoProdutoId: string | null;
  sugestaoCodigo: string | null;
  sugestaoDescricao: string | null;
}

interface ImportacaoXml {
  id: string;
  arquivoNome: string;
  fornecedorNome: string;
  emitidaEm: string | null;
  valorTotal: string;
  status: 'PENDENTE_REVISAO' | 'PROCESSADO' | 'ERRO' | 'DESFEITO';
  itens: ItemXml[];
}

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Leitura' },
  { id: 3, label: 'Revisao' },
  { id: 4, label: 'Confirmacao' },
] as const;

export function RevisarClient({ id }: { id: string }) {
  const router = useRouter();
  const [importacao, setImportacao] = useState<ImportacaoXml | null>(null);
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, Vinculo>>({});
  const [produtoIds, setProdutoIds] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [impRes, prodRes] = await Promise.all([
          fetch(`/api/estoque/importacoes/${id}`, { cache: 'no-store' }),
          fetch('/api/produtos?page=1&pageSize=100&ativo=true', { cache: 'no-store' }),
        ]);
        if (!impRes.ok) throw new Error('Importacao nao encontrada');
        const imp: ImportacaoXml = await impRes.json();
        const prodPayload = prodRes.ok ? await prodRes.json() : { items: [] };
        setImportacao(imp);
        setProdutos(prodPayload.items ?? []);
        setVinculos(
          imp.itens.reduce<Record<string, Vinculo>>((acc, item) => {
            acc[item.id] = item.sugestaoProdutoId ? 'match' : 'novo';
            return acc;
          }, {}),
        );
        setProdutoIds(
          imp.itens.reduce<Record<string, string>>((acc, item) => {
            if (item.sugestaoProdutoId) acc[item.id] = item.sugestaoProdutoId;
            return acc;
          }, {}),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Falha ao carregar importacao');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  const itens = importacao?.itens ?? [];
  const totais = useMemo(() => {
    let atualizar = 0;
    let criar = 0;
    let ignorar = 0;
    for (const item of itens) {
      const v = vinculos[item.id];
      if (v === 'match') atualizar += 1;
      else if (v === 'novo') criar += 1;
      else ignorar += 1;
    }
    return { atualizar, criar, ignorar };
  }, [itens, vinculos]);

  const handleConfirmar = async () => {
    if (!importacao) return;
    setSaving(true);
    try {
      const decisions = importacao.itens.map((item) => {
        const vinculo = vinculos[item.id] ?? 'ignorar';
        if (vinculo === 'ignorar') return { itemId: item.id, acao: 'ignorar' as const };
        if (vinculo === 'match') {
          const produtoId = produtoIds[item.id];
          if (!produtoId) throw new Error(`Selecione um produto para ${item.descricao}`);
          return { itemId: item.id, acao: 'vincular' as const, produtoId };
        }
        return {
          itemId: item.id,
          acao: 'criar' as const,
          codigo: item.codigoFornecedor || `XML-${item.id}`,
          descricao: item.descricao,
          ncm: item.ncm,
          unidade: item.unidade,
          precoVenda: item.valorUnitario,
        };
      });

      const res = await fetch(`/api/estoque/importacoes/${id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao confirmar importacao');
      toast.success('Importacao concluida. Estoque atualizado.');
      router.push('/estoque');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao confirmar importacao');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando importacao...
      </div>
    );
  }

  if (!importacao) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/importar">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Importacao nao encontrada ou indisponivel.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/importar">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revisao de Importacao</h1>
          <p className="text-muted-foreground">
            Confira os vinculos dos itens do XML antes de atualizar o estoque.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetaCard label="Arquivo" value={importacao.arquivoNome} mono />
          <MetaCard label="Fornecedor" value={importacao.fornecedorNome} />
          <MetaCard
            label="Data emissao"
            value={
              importacao.emitidaEm
                ? new Date(importacao.emitidaEm).toLocaleDateString('pt-BR')
                : '-'
            }
          />
          <MetaCard label="Valor total" value={<Money value={Number(importacao.valorTotal)} />} />
          <MetaCard label="Itens" value={String(importacao.itens.length)} />
        </div>

        <Stepper current={importacao.status === 'PROCESSADO' ? 4 : 3} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Descricao (XML)</th>
                <th className="px-4 py-3 font-semibold">NCM</th>
                <th className="px-4 py-3 text-center font-semibold">UN</th>
                <th className="px-4 py-3 text-right font-semibold">Qtd</th>
                <th className="px-4 py-3 text-right font-semibold">Valor unit</th>
                <th className="px-4 py-3 text-right font-semibold">Valor total</th>
                <th className="px-4 py-3 font-semibold">Vinculo</th>
              </tr>
            </thead>
            <tbody>
              {importacao.itens.map((item) => {
                const v = vinculos[item.id] ?? 'ignorar';
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b last:border-0',
                      v === 'match' && 'bg-brand-green/5',
                      v === 'novo' && 'bg-brand-warning/5',
                      v === 'ignorar' && 'bg-muted/30',
                    )}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="font-medium">{item.descricao}</div>
                      {item.sugestaoCodigo ? (
                        <div className="text-xs text-brand-green">
                          Sugestao: {item.sugestaoDescricao} ({item.sugestaoCodigo})
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="font-mono text-xs">{item.ncm}</span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle text-xs font-semibold">
                      {item.unidade}
                    </td>
                    <td className="px-4 py-3 text-right align-middle tabular-nums">
                      {Number(item.quantidade)}
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <Money value={Number(item.valorUnitario)} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <Money value={Number(item.valorTotal)} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <VinculoSelect
                        vinculo={v}
                        produtoId={produtoIds[item.id]}
                        produtos={produtos}
                        disabled={importacao.status !== 'PENDENTE_REVISAO'}
                        onChangeVinculo={(next) => {
                          setVinculos((prev) => ({ ...prev, [item.id]: next }));
                          if (next !== 'match') {
                            setProdutoIds((prev) => {
                              const copy = { ...prev };
                              delete copy[item.id];
                              return copy;
                            });
                          }
                        }}
                        onChangeProduto={(produtoId) => {
                          setProdutoIds((prev) => ({ ...prev, [item.id]: produtoId }));
                          setVinculos((prev) => ({ ...prev, [item.id]: 'match' }));
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto flex flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge
              variant="secondary"
              className="bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
            >
              {totais.atualizar} vinculados
            </Badge>
            <Badge
              variant="secondary"
              className="bg-brand-warning/10 text-brand-warning hover:bg-brand-warning/20"
            >
              {totais.criar} a criar
            </Badge>
            <Badge variant="secondary">{totais.ignorar} ignorados</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/importar">Cancelar</Link>
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={saving || importacao.status !== 'PENDENTE_REVISAO'}
            >
              Confirmar importacao
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importacao</DialogTitle>
            <DialogDescription>
              Esta acao cria as movimentacoes de entrada e atualiza o saldo calculado do estoque.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaCard({
  label,
  value,
  mono,
}: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn('mt-0.5 truncate text-sm font-semibold', mono && 'font-mono text-xs')}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-card p-3">
      {STEPS.map((step, idx) => {
        const isActive = step.id === current;
        const isDone = step.id < current;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isDone && 'bg-brand-green text-white',
                isActive && 'bg-brand-blue text-white',
                !isActive && !isDone && 'bg-muted text-muted-foreground',
              )}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : step.id}
            </div>
            <span
              className={cn(
                'whitespace-nowrap text-xs font-medium sm:text-sm',
                isActive && 'font-semibold',
              )}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 ? (
              <div
                className={cn('h-px w-6 shrink-0 sm:w-12', isDone ? 'bg-brand-green' : 'bg-border')}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function VinculoSelect({
  vinculo,
  produtoId,
  produtos,
  disabled,
  onChangeVinculo,
  onChangeProduto,
}: {
  vinculo: Vinculo;
  produtoId: string | undefined;
  produtos: ProdutoOption[];
  disabled: boolean;
  onChangeVinculo: (v: Vinculo) => void;
  onChangeProduto: (produtoId: string) => void;
}) {
  const value = vinculo === 'match' && produtoId ? `match:${produtoId}` : vinculo;
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v.startsWith('match:')) onChangeProduto(v.slice('match:'.length));
        else onChangeVinculo(v as Vinculo);
      }}
      className="h-9 min-w-[240px] rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Vinculo do item"
    >
      <optgroup label="Vincular a produto existente">
        {produtos.map((p) => (
          <option key={p.id} value={`match:${p.id}`}>
            {p.descricao} ({p.codigo})
          </option>
        ))}
      </optgroup>
      <option value="novo">Criar novo produto</option>
      <option value="ignorar">Ignorar este item</option>
    </select>
  );
}
