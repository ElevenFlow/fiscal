'use client';

import { FormField } from '@/components/forms/form-field';
import { numberToBRL } from '@/components/forms/masks';
import {
  type Fornecedor,
  fornecedores as fixtureFornecedores,
  produtos as fixtureProdutos,
} from '@/lib/mock-data';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Money,
  Separator,
  cn,
} from '@nexo/ui';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Download,
  FilePlus,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type StepId = 1 | 2 | 3 | 4;

interface NfOrigem {
  id: string;
  numero: string;
  serie: string;
  data: string;
  fornecedor: Fornecedor;
  chaveAcesso: string;
  valor: number;
  cfop: string;
  itens: ItemOrigem[];
}

interface ItemOrigem {
  sku: string;
  descricao: string;
  qtdOriginal: number;
  valorUnit: number;
}

// Mock de NF-e de compra (fornecedor → nós). Cria 5 notas baseadas em fornecedores + produtos
// dos fixtures.
const NOTAS_ORIGEM: NfOrigem[] = [
  {
    id: 'nfo-1',
    numero: '001870',
    serie: '1',
    data: '10/04/2026',
    fornecedor: fixtureFornecedores[1] as Fornecedor,
    chaveAcesso: '3526 0488 9990 0000 0121 5500 1000 0018 7010 4455 7788',
    valor: 4820.3,
    cfop: '1102',
    itens: [
      {
        sku: fixtureProdutos[0]?.sku ?? 'CAB-FLEX-2.5',
        descricao: fixtureProdutos[0]?.descricao ?? 'Cabo Flexível 2,5mm² 750V Rolo 100m',
        qtdOriginal: 10,
        valorUnit: fixtureProdutos[0]?.precoCusto ?? 189.9,
      },
      {
        sku: fixtureProdutos[3]?.sku ?? 'DIS-20A-BIP',
        descricao: fixtureProdutos[3]?.descricao ?? 'Disjuntor Bipolar 20A Curva C',
        qtdOriginal: 20,
        valorUnit: fixtureProdutos[3]?.precoCusto ?? 34.0,
      },
      {
        sku: fixtureProdutos[4]?.sku ?? 'LED-LUM-18W',
        descricao: fixtureProdutos[4]?.descricao ?? 'Luminária LED Plafon 18W',
        qtdOriginal: 12,
        valorUnit: fixtureProdutos[4]?.precoCusto ?? 28.0,
      },
    ],
  },
  {
    id: 'nfo-2',
    numero: '001842',
    serie: '1',
    data: '05/04/2026',
    fornecedor: fixtureFornecedores[0] as Fornecedor,
    chaveAcesso: '3526 0377 8899 9000 0110 5500 1000 0018 4210 3322 1100',
    valor: 1720.0,
    cfop: '1102',
    itens: [
      {
        sku: fixtureProdutos[1]?.sku ?? 'TEC-USB-BR01',
        descricao: fixtureProdutos[1]?.descricao ?? 'Teclado USB ABNT2 Preto',
        qtdOriginal: 30,
        valorUnit: fixtureProdutos[1]?.precoCusto ?? 39.5,
      },
      {
        sku: fixtureProdutos[2]?.sku ?? 'CXO-ORG-25L',
        descricao: fixtureProdutos[2]?.descricao ?? 'Caixa Organizadora 25L',
        qtdOriginal: 25,
        valorUnit: fixtureProdutos[2]?.precoCusto ?? 22.0,
      },
    ],
  },
  {
    id: 'nfo-3',
    numero: '001810',
    serie: '1',
    data: '28/03/2026',
    fornecedor: fixtureFornecedores[2] as Fornecedor,
    chaveAcesso: '3526 0299 0001 1100 0132 5500 1000 0018 1010 9988 7722',
    valor: 980.4,
    cfop: '1102',
    itens: [
      {
        sku: fixtureProdutos[4]?.sku ?? 'LED-LUM-18W',
        descricao: fixtureProdutos[4]?.descricao ?? 'Luminária LED Plafon 18W',
        qtdOriginal: 15,
        valorUnit: fixtureProdutos[4]?.precoCusto ?? 28.0,
      },
    ],
  },
  {
    id: 'nfo-4',
    numero: '001789',
    serie: '1',
    data: '20/03/2026',
    fornecedor: fixtureFornecedores[1] as Fornecedor,
    chaveAcesso: '3526 0288 9990 0000 0121 5500 1000 0017 8910 6655 4433',
    valor: 3150.0,
    cfop: '1102',
    itens: [
      {
        sku: fixtureProdutos[0]?.sku ?? 'CAB-FLEX-2.5',
        descricao: fixtureProdutos[0]?.descricao ?? 'Cabo Flexível 2,5mm² 750V',
        qtdOriginal: 8,
        valorUnit: fixtureProdutos[0]?.precoCusto ?? 189.9,
      },
    ],
  },
  {
    id: 'nfo-5',
    numero: '001755',
    serie: '1',
    data: '12/03/2026',
    fornecedor: fixtureFornecedores[0] as Fornecedor,
    chaveAcesso: '3526 0177 8899 9000 0110 5500 1000 0017 5510 2211 3344',
    valor: 2240.5,
    cfop: '1102',
    itens: [
      {
        sku: fixtureProdutos[3]?.sku ?? 'DIS-20A-BIP',
        descricao: fixtureProdutos[3]?.descricao ?? 'Disjuntor Bipolar 20A Curva C',
        qtdOriginal: 40,
        valorUnit: fixtureProdutos[3]?.precoCusto ?? 34.0,
      },
      {
        sku: fixtureProdutos[2]?.sku ?? 'CXO-ORG-25L',
        descricao: fixtureProdutos[2]?.descricao ?? 'Caixa Organizadora 25L',
        qtdOriginal: 35,
        valorUnit: fixtureProdutos[2]?.precoCusto ?? 22.0,
      },
    ],
  },
];

const MOTIVOS_PADRAO = [
  { value: 'divergencia', label: 'Divergência de pedido' },
  { value: 'danificado', label: 'Produto danificado' },
  { value: 'defeito', label: 'Produto com defeito' },
  { value: 'validade', label: 'Prazo de validade' },
  { value: 'comercial', label: 'Devolução comercial' },
  { value: 'outro', label: 'Outro' },
] as const;
type MotivoValue = (typeof MOTIVOS_PADRAO)[number]['value'];

interface ItemDevolucao {
  sku: string;
  qtdDevolver: number;
}

const STEPS = [
  { id: 1 as StepId, label: 'Selecionar NF-e origem' },
  { id: 2 as StepId, label: 'Selecionar itens' },
  { id: 3 as StepId, label: 'Motivo' },
  { id: 4 as StepId, label: 'Revisão e emissão' },
];

export function DevolucaoClient() {
  const [step, setStep] = useState<StepId>(1);

  // Step 1
  const [buscaChave, setBuscaChave] = useState('');
  const [buscaNumero, setBuscaNumero] = useState('');
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [notaSelecionada, setNotaSelecionada] = useState<NfOrigem | null>(null);

  // Step 2
  const [itensDevolucao, setItensDevolucao] = useState<Record<string, ItemDevolucao>>({});

  // Step 3
  const [motivo, setMotivo] = useState<MotivoValue | ''>('');
  const [motivoOutroTexto, setMotivoOutroTexto] = useState('');
  const [observacao, setObservacao] = useState('');

  // Step 4
  const [emitindo, setEmitindo] = useState(false);
  const [sucessoOpen, setSucessoOpen] = useState(false);
  const [numeroGerado, setNumeroGerado] = useState('000035');

  const notasFiltradas = useMemo(() => {
    const term = (buscaChave || buscaNumero || buscaFornecedor).trim().toLowerCase() || '';
    if (!term) return NOTAS_ORIGEM;
    return NOTAS_ORIGEM.filter((n) => {
      const matchChave = buscaChave
        ? n.chaveAcesso.replace(/\s/g, '').includes(buscaChave.replace(/\s/g, ''))
        : true;
      const matchNumero = buscaNumero ? n.numero.includes(buscaNumero) : true;
      const matchForn = buscaFornecedor
        ? n.fornecedor.razaoSocial.toLowerCase().includes(buscaFornecedor.toLowerCase())
        : true;
      return matchChave && matchNumero && matchForn;
    });
  }, [buscaChave, buscaNumero, buscaFornecedor]);

  const itensSelecionados = useMemo(() => {
    if (!notaSelecionada) return [];
    return notaSelecionada.itens
      .map((it) => {
        const sel = itensDevolucao[it.sku];
        if (!sel || sel.qtdDevolver <= 0) return null;
        return { ...it, qtdDevolver: Math.min(sel.qtdDevolver, it.qtdOriginal) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [notaSelecionada, itensDevolucao]);

  const totalDevolucao = useMemo(
    () => itensSelecionados.reduce((acc, it) => acc + it.qtdDevolver * it.valorUnit, 0),
    [itensSelecionados],
  );

  const motivoTexto = useMemo(() => {
    if (motivo === 'outro') return motivoOutroTexto || 'Outro';
    return MOTIVOS_PADRAO.find((m) => m.value === motivo)?.label ?? '';
  }, [motivo, motivoOutroTexto]);

  const canAdvance = (to: StepId): boolean => {
    if (to <= step) return true;
    if (to === 2) return !!notaSelecionada;
    if (to === 3) return !!notaSelecionada && itensSelecionados.length > 0;
    if (to === 4)
      return (
        !!notaSelecionada &&
        itensSelecionados.length > 0 &&
        motivo !== '' &&
        (motivo !== 'outro' || motivoOutroTexto.trim().length > 0)
      );
    return false;
  };

  const handleSelecionarNota = (n: NfOrigem) => {
    setNotaSelecionada(n);
    // pré-popula com 0
    const initial: Record<string, ItemDevolucao> = {};
    for (const it of n.itens) initial[it.sku] = { sku: it.sku, qtdDevolver: 0 };
    setItensDevolucao(initial);
  };

  const handleEmitir = () => {
    setEmitindo(true);
    setTimeout(() => {
      setEmitindo(false);
      const n = 35 + Math.floor(Math.random() * 10);
      setNumeroGerado(String(n).padStart(6, '0'));
      setSucessoOpen(true);
    }, 2000);
  };

  const handleNovaDevolucao = () => {
    setSucessoOpen(false);
    setStep(1);
    setNotaSelecionada(null);
    setItensDevolucao({});
    setMotivo('');
    setMotivoOutroTexto('');
    setObservacao('');
    setBuscaChave('');
    setBuscaNumero('');
    setBuscaFornecedor('');
    toast.info('Pronto para nova devolução');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <nav
          aria-label="Trilha de navegação"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/emitir" className="hover:text-foreground">
            Emitir
          </Link>
          <ChevronRight className="h-4 w-4" aria-hidden />
          <span className="font-medium text-foreground">Devolução</span>
        </nav>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emitir nota de devolução</h1>
          <p className="text-muted-foreground">
            Devolução de NF-e de compra. Selecione a nota de origem e os itens a devolver ao
            fornecedor.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="rounded-md border bg-card p-4">
        <ol className="flex flex-col gap-3 md:flex-row md:items-center md:gap-0">
          {STEPS.map((s, idx) => {
            const active = s.id === step;
            const done = s.id < step;
            const clickable = canAdvance(s.id);
            return (
              <li key={s.id} className="flex flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={() => clickable && setStep(s.id)}
                  disabled={!clickable}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-1 text-left transition-colors',
                    clickable ? 'hover:bg-muted/40' : 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                      active && 'border-brand-blue bg-brand-blue text-white',
                      done && 'border-brand-green bg-brand-green text-white',
                      !active && !done && 'border-muted-foreground/30 text-muted-foreground',
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : s.id}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {idx < STEPS.length - 1 ? (
                  <div className="hidden h-px flex-1 bg-border md:block" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step content */}
      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Busque a NF-e de origem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Chave de acesso (44 dígitos)" htmlFor="bs-chave">
                <Input
                  id="bs-chave"
                  value={buscaChave}
                  onChange={(e) => setBuscaChave(e.target.value)}
                  placeholder="3526 0488..."
                  className="font-mono text-xs"
                />
              </FormField>
              <FormField label="Número da nota" htmlFor="bs-num">
                <Input
                  id="bs-num"
                  value={buscaNumero}
                  onChange={(e) => setBuscaNumero(e.target.value)}
                  placeholder="001870"
                />
              </FormField>
              <FormField label="Fornecedor" htmlFor="bs-forn">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="bs-forn"
                    value={buscaFornecedor}
                    onChange={(e) => setBuscaFornecedor(e.target.value)}
                    placeholder="Nome do fornecedor..."
                    className="pl-9"
                  />
                </div>
              </FormField>
            </div>
            <div className="text-xs text-muted-foreground">
              {notasFiltradas.length} nota{notasFiltradas.length === 1 ? '' : 's'} encontrada
              {notasFiltradas.length === 1 ? '' : 's'}
            </div>
            <div className="space-y-2">
              {notasFiltradas.map((n) => {
                const selected = notaSelecionada?.id === n.id;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'rounded-md border p-3 transition-colors',
                      selected && 'border-brand-blue bg-brand-blue/5',
                    )}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="font-mono">
                            NF-e {n.numero}/{n.serie}
                          </Badge>
                          <span className="text-sm font-semibold">{n.fornecedor.razaoSocial}</span>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {n.chaveAcesso}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {n.data} · {n.fornecedor.cidade}/{n.fornecedor.uf}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <Money value={n.valor} className="text-base font-semibold" />
                        <Button
                          variant={selected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleSelecionarNota(n)}
                        >
                          {selected ? 'Selecionada' : 'Selecionar'}
                        </Button>
                      </div>
                    </div>

                    {selected ? (
                      <div className="mt-3 rounded-md border bg-muted/30 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Itens da nota
                        </div>
                        <ul className="mt-2 space-y-1 text-sm">
                          {n.itens.map((it) => (
                            <li key={it.sku} className="flex justify-between">
                              <span>{it.descricao}</span>
                              <span className="font-mono tabular-nums text-muted-foreground">
                                {it.qtdOriginal} × {numberToBRL(it.valorUnit)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button disabled={!notaSelecionada} onClick={() => setStep(2)}>
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && notaSelecionada ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. Itens da NF-e {notaSelecionada.numero} — {notaSelecionada.fornecedor.razaoSocial}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">
                      <input
                        type="checkbox"
                        aria-label="Selecionar tudo"
                        onChange={(e) => {
                          const all = e.target.checked;
                          const next: Record<string, ItemDevolucao> = {};
                          for (const it of notaSelecionada.itens) {
                            next[it.sku] = {
                              sku: it.sku,
                              qtdDevolver: all ? it.qtdOriginal : 0,
                            };
                          }
                          setItensDevolucao(next);
                        }}
                      />
                    </th>
                    <th className="px-3 py-2 font-semibold">Descrição</th>
                    <th className="px-3 py-2 text-right font-semibold">Qtd original</th>
                    <th className="px-3 py-2 text-right font-semibold">Valor unit</th>
                    <th className="px-3 py-2 text-right font-semibold">Qtd a devolver</th>
                    <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {notaSelecionada.itens.map((it) => {
                    const sel = itensDevolucao[it.sku];
                    const qtd = sel?.qtdDevolver ?? 0;
                    const marcado = qtd > 0;
                    const subtotal = qtd * it.valorUnit;
                    return (
                      <tr key={it.sku} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={marcado}
                            aria-label={`Selecionar ${it.descricao}`}
                            onChange={(e) => {
                              setItensDevolucao((prev) => ({
                                ...prev,
                                [it.sku]: {
                                  sku: it.sku,
                                  qtdDevolver: e.target.checked ? it.qtdOriginal : 0,
                                },
                              }));
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{it.descricao}</div>
                          <div className="font-mono text-xs text-muted-foreground">{it.sku}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {it.qtdOriginal}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Money value={it.valorUnit} hideCurrency />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={it.qtdOriginal}
                            value={qtd}
                            onChange={(e) => {
                              const v = Math.max(
                                0,
                                Math.min(it.qtdOriginal, Number(e.target.value) || 0),
                              );
                              setItensDevolucao((prev) => ({
                                ...prev,
                                [it.sku]: { sku: it.sku, qtdDevolver: v },
                              }));
                            }}
                            className="h-8 w-20 rounded border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Money value={subtotal} hideCurrency className="font-semibold" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong>{itensSelecionados.length}</strong> ite
                {itensSelecionados.length === 1 ? 'm' : 'ns'} selecionado
                {itensSelecionados.length === 1 ? '' : 's'}
              </span>
              <span className="text-muted-foreground">
                Valor total a devolver:{' '}
                <Money value={totalDevolucao} className="font-semibold text-foreground" />
              </span>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Voltar
              </Button>
              <Button disabled={itensSelecionados.length === 0} onClick={() => setStep(3)}>
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Motivo da devolução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Selecione um motivo</legend>
              <div className="grid gap-2 md:grid-cols-2">
                {MOTIVOS_PADRAO.map((m) => (
                  <label
                    key={m.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                      motivo === m.value
                        ? 'border-brand-blue bg-brand-blue/5'
                        : 'border-input hover:bg-muted/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="motivo"
                      value={m.value}
                      checked={motivo === m.value}
                      onChange={() => setMotivo(m.value)}
                      className="h-4 w-4"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {motivo === 'outro' ? (
              <FormField label="Especifique o motivo" htmlFor="motivo-outro" required>
                <textarea
                  id="motivo-outro"
                  value={motivoOutroTexto}
                  onChange={(e) => setMotivoOutroTexto(e.target.value)}
                  rows={3}
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  placeholder="Descreva o motivo da devolução..."
                />
              </FormField>
            ) : null}

            <FormField label="Observação adicional (opcional)" htmlFor="obs">
              <textarea
                id="obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                placeholder="Detalhes adicionais que ficam na nota..."
              />
            </FormField>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Voltar
              </Button>
              <Button
                disabled={!motivo || (motivo === 'outro' && !motivoOutroTexto.trim())}
                onClick={() => setStep(4)}
              >
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && notaSelecionada ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Revisão e emissão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-brand-warning" aria-hidden />
                <h2 className="text-lg font-semibold">Nota de Devolução</h2>
              </div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">NF-e origem</dt>
                  <dd className="font-mono font-semibold">
                    {notaSelecionada.numero}/{notaSelecionada.serie}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fornecedor</dt>
                  <dd className="font-semibold">{notaSelecionada.fornecedor.razaoSocial}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CFOP (devolução)</dt>
                  <dd className="font-mono font-semibold">1202</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Motivo</dt>
                  <dd className="font-semibold">{motivoTexto}</dd>
                </div>
              </dl>

              <Separator className="my-4" />

              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Itens a devolver
              </div>
              <ul className="mt-2 space-y-2">
                {itensSelecionados.map((it) => (
                  <li key={it.sku} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{it.descricao}</div>
                      <div className="font-mono text-xs text-muted-foreground">{it.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono tabular-nums">
                        {it.qtdDevolver} × {numberToBRL(it.valorUnit)}
                      </div>
                      <Money
                        value={it.qtdDevolver * it.valorUnit}
                        hideCurrency
                        className="text-xs text-muted-foreground"
                      />
                    </div>
                  </li>
                ))}
              </ul>

              {observacao ? (
                <>
                  <Separator className="my-4" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Observação
                    </div>
                    <p className="mt-1 text-sm">{observacao}</p>
                  </div>
                </>
              ) : null}

              <Separator className="my-4" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Valor total da devolução</span>
                <Money
                  value={totalDevolucao}
                  className="text-2xl font-bold tracking-tight text-brand-blue"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-brand-warning/40 bg-brand-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-warning" aria-hidden />
              <p>
                Após emitir, os valores serão deduzidos do fornecedor e a nota ficará disponível em
                Documentos Fiscais.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                Voltar
              </Button>
              <Button onClick={handleEmitir} disabled={emitindo} size="lg">
                {emitindo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="mr-2 h-4 w-4" aria-hidden />
                )}
                {emitindo ? 'Emitindo…' : 'Emitir devolução'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Loading */}
      <Dialog open={emitindo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Emitindo nota de devolução…</DialogTitle>
            <DialogDescription>Transmitindo à SEFAZ (mock 2s).</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-10 w-10 animate-spin text-brand-blue" aria-hidden />
          </div>
        </DialogContent>
      </Dialog>

      {/* Sucesso */}
      <Dialog open={sucessoOpen} onOpenChange={setSucessoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-status-autorizada/10">
              <CheckCircle2 className="h-6 w-6 text-status-autorizada" aria-hidden />
            </div>
            <DialogTitle>NF-e de Devolução {numeroGerado} autorizada</DialogTitle>
            <DialogDescription>
              Emitida com sucesso. O estoque e o saldo do fornecedor foram atualizados (mock).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fornecedor</span>
                <span className="font-medium">
                  {notaSelecionada?.fornecedor.razaoSocial ?? '—'}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Valor devolvido</span>
                <Money value={totalDevolucao} className="font-semibold" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => toast.success('PDF baixado (mock)')}>
                <Download className="mr-2 h-4 w-4" aria-hidden />
                Baixar
              </Button>
              <Button variant="outline" onClick={handleNovaDevolucao}>
                <FilePlus className="mr-2 h-4 w-4" aria-hidden />
                Nova
              </Button>
              <Button asChild>
                <Link href="/documentos">
                  <FileText className="mr-2 h-4 w-4" aria-hidden />
                  Ver
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
