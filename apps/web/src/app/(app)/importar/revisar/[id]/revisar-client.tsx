'use client';

import { produtos as fixtureProdutos } from '@/lib/mock-data';
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
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Vinculo = 'match' | 'novo' | 'ignorar';

interface ItemXml {
  id: string;
  descricaoXml: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valorUnit: number;
  valorTotal: number;
  /** SKU sugerido se há match automático com catálogo. */
  sugestaoSku?: string;
  sugestaoDescricao?: string;
  /** Estado inicial do vínculo (default deriva de sugestaoSku). */
  vinculoInicial: Vinculo;
}

// Mock de ~20 itens com mix de matches automáticos, sem match e ignorados.
// Alguns SKUs batem com fixtures em mock-data.ts para demonstrar "match por
// NCM + descrição" (CAB-FLEX-2.5, TEC-USB-BR01, etc).
const ITENS_MOCK: ItemXml[] = [
  {
    id: 'it-01',
    descricaoXml: 'CABO FLEXIVEL 2,5MM 750V ROLO 100M',
    ncm: '8544.49.00',
    unidade: 'RL',
    quantidade: 10,
    valorUnit: 189.9,
    valorTotal: 1899.0,
    sugestaoSku: 'CAB-FLEX-2.5',
    sugestaoDescricao: 'Cabo Flexível 2,5mm² 750V Rolo 100m',
    vinculoInicial: 'match',
  },
  {
    id: 'it-02',
    descricaoXml: 'TECLADO USB ABNT2 PRETO MOD. BR01',
    ncm: '8471.60.52',
    unidade: 'UN',
    quantidade: 25,
    valorUnit: 39.5,
    valorTotal: 987.5,
    sugestaoSku: 'TEC-USB-BR01',
    sugestaoDescricao: 'Teclado USB ABNT2 Preto',
    vinculoInicial: 'match',
  },
  {
    id: 'it-03',
    descricaoXml: 'CAIXA ORGANIZADORA PLASTICA 25L C/ TAMPA',
    ncm: '3924.90.00',
    unidade: 'UN',
    quantidade: 40,
    valorUnit: 22.0,
    valorTotal: 880.0,
    sugestaoSku: 'CXO-ORG-25L',
    sugestaoDescricao: 'Caixa Organizadora Plástica 25L com Tampa',
    vinculoInicial: 'match',
  },
  {
    id: 'it-04',
    descricaoXml: 'DISJUNTOR BIPOLAR 20A CURVA C',
    ncm: '8536.20.00',
    unidade: 'UN',
    quantidade: 30,
    valorUnit: 34.0,
    valorTotal: 1020.0,
    sugestaoSku: 'DIS-20A-BIP',
    sugestaoDescricao: 'Disjuntor Bipolar 20A Curva C',
    vinculoInicial: 'match',
  },
  {
    id: 'it-05',
    descricaoXml: 'LUMINARIA LED PLAFON 18W BRANCO FRIO',
    ncm: '9405.10.99',
    unidade: 'UN',
    quantidade: 15,
    valorUnit: 28.0,
    valorTotal: 420.0,
    sugestaoSku: 'LED-LUM-18W',
    sugestaoDescricao: 'Luminária LED Plafon 18W Branco Frio',
    vinculoInicial: 'match',
  },
  {
    id: 'it-06',
    descricaoXml: 'TOMADA 2P+T 10A BRANCA',
    ncm: '8536.69.90',
    unidade: 'UN',
    quantidade: 60,
    valorUnit: 4.9,
    valorTotal: 294.0,
    vinculoInicial: 'novo',
  },
  {
    id: 'it-07',
    descricaoXml: 'INTERRUPTOR SIMPLES 10A',
    ncm: '8536.50.90',
    unidade: 'UN',
    quantidade: 80,
    valorUnit: 5.2,
    valorTotal: 416.0,
    vinculoInicial: 'novo',
  },
  {
    id: 'it-08',
    descricaoXml: 'FITA ISOLANTE 19MMx20M PRETA',
    ncm: '3919.10.00',
    unidade: 'RL',
    quantidade: 50,
    valorUnit: 3.8,
    valorTotal: 190.0,
    vinculoInicial: 'novo',
  },
  {
    id: 'it-09',
    descricaoXml: 'MOUSE USB OPTICO 1000DPI PRETO',
    ncm: '8471.60.53',
    unidade: 'UN',
    quantidade: 20,
    valorUnit: 24.9,
    valorTotal: 498.0,
    vinculoInicial: 'ignorar',
  },
  {
    id: 'it-10',
    descricaoXml: 'PARAFUSO AUTOATARRAXANTE 4x30 C/100',
    ncm: '7318.14.00',
    unidade: 'CX',
    quantidade: 10,
    valorUnit: 18.9,
    valorTotal: 189.0,
    vinculoInicial: 'match',
    sugestaoSku: 'CAB-FLEX-2.5', // demonstra match por similaridade (placeholder)
    sugestaoDescricao: 'Cabo Flexível 2,5mm² 750V Rolo 100m',
  },
  {
    id: 'it-11',
    descricaoXml: 'CABO HDMI 2.0 1,8M',
    ncm: '8544.42.00',
    unidade: 'UN',
    quantidade: 15,
    valorUnit: 14.5,
    valorTotal: 217.5,
    vinculoInicial: 'match',
    sugestaoSku: 'TEC-USB-BR01',
    sugestaoDescricao: 'Teclado USB ABNT2 Preto',
  },
  {
    id: 'it-12',
    descricaoXml: 'EXTENSAO ELETRICA 5M 3 TOMADAS',
    ncm: '8544.42.00',
    unidade: 'UN',
    quantidade: 12,
    valorUnit: 38.9,
    valorTotal: 466.8,
    vinculoInicial: 'match',
    sugestaoSku: 'CAB-FLEX-2.5',
    sugestaoDescricao: 'Cabo Flexível 2,5mm² 750V Rolo 100m',
  },
  {
    id: 'it-13',
    descricaoXml: 'LAMPADA LED 9W E27 6500K',
    ncm: '8539.50.00',
    unidade: 'UN',
    quantidade: 100,
    valorUnit: 6.5,
    valorTotal: 650.0,
    vinculoInicial: 'match',
    sugestaoSku: 'LED-LUM-18W',
    sugestaoDescricao: 'Luminária LED Plafon 18W Branco Frio',
  },
  {
    id: 'it-14',
    descricaoXml: 'CANALETA PVC 20x10 2M BRANCA',
    ncm: '3925.90.00',
    unidade: 'UN',
    quantidade: 40,
    valorUnit: 8.9,
    valorTotal: 356.0,
    vinculoInicial: 'novo',
  },
  {
    id: 'it-15',
    descricaoXml: 'ABRACADEIRA NYLON 200MM C/100',
    ncm: '3926.90.90',
    unidade: 'CX',
    quantidade: 20,
    valorUnit: 12.5,
    valorTotal: 250.0,
    vinculoInicial: 'match',
    sugestaoSku: 'CXO-ORG-25L',
    sugestaoDescricao: 'Caixa Organizadora Plástica 25L com Tampa',
  },
  {
    id: 'it-16',
    descricaoXml: 'FIO PARALELO 2x1,5MM 100M',
    ncm: '8544.49.00',
    unidade: 'RL',
    quantidade: 8,
    valorUnit: 98.0,
    valorTotal: 784.0,
    vinculoInicial: 'match',
    sugestaoSku: 'CAB-FLEX-2.5',
    sugestaoDescricao: 'Cabo Flexível 2,5mm² 750V Rolo 100m',
  },
  {
    id: 'it-17',
    descricaoXml: 'CONECTOR WAGO 3 VIAS C/50',
    ncm: '8536.90.90',
    unidade: 'CX',
    quantidade: 10,
    valorUnit: 42.0,
    valorTotal: 420.0,
    vinculoInicial: 'match',
    sugestaoSku: 'DIS-20A-BIP',
    sugestaoDescricao: 'Disjuntor Bipolar 20A Curva C',
  },
  {
    id: 'it-18',
    descricaoXml: 'SENSOR PRESENCA INFRAVERMELHO 360',
    ncm: '8537.10.90',
    unidade: 'UN',
    quantidade: 5,
    valorUnit: 52.0,
    valorTotal: 260.0,
    vinculoInicial: 'match',
    sugestaoSku: 'LED-LUM-18W',
    sugestaoDescricao: 'Luminária LED Plafon 18W Branco Frio',
  },
  {
    id: 'it-19',
    descricaoXml: 'FERRAMENTA BRINDE — DESCONSIDERAR',
    ncm: '0000.00.00',
    unidade: 'UN',
    quantidade: 1,
    valorUnit: 0,
    valorTotal: 0,
    vinculoInicial: 'ignorar',
  },
  {
    id: 'it-20',
    descricaoXml: 'CABO REDE CAT6 CX 305M',
    ncm: '8544.42.00',
    unidade: 'CX',
    quantidade: 4,
    valorUnit: 420.0,
    valorTotal: 1680.0,
    vinculoInicial: 'match',
    sugestaoSku: 'CAB-FLEX-2.5',
    sugestaoDescricao: 'Cabo Flexível 2,5mm² 750V Rolo 100m',
  },
];

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Leitura' },
  { id: 3, label: 'Revisão' },
  { id: 4, label: 'Confirmação' },
] as const;

// Dropdown options derivadas dos produtos do catálogo. Vamos limitar aos 10
// primeiros para não poluir; numa app real seria combobox com busca.
const CATALOGO = fixtureProdutos;

export function RevisarClient({ id }: { id: string }) {
  const router = useRouter();
  const [vinculos, setVinculos] = useState<Record<string, Vinculo>>(() =>
    ITENS_MOCK.reduce<Record<string, Vinculo>>((acc, item) => {
      acc[item.id] = item.vinculoInicial;
      return acc;
    }, {}),
  );
  const [skus, setSkus] = useState<Record<string, string>>(() =>
    ITENS_MOCK.reduce<Record<string, string>>((acc, item) => {
      if (item.sugestaoSku) acc[item.id] = item.sugestaoSku;
      return acc;
    }, {}),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const totais = useMemo(() => {
    let atualizar = 0;
    let criar = 0;
    let ignorar = 0;
    for (const item of ITENS_MOCK) {
      const v = vinculos[item.id];
      if (v === 'match') atualizar += 1;
      else if (v === 'novo') criar += 1;
      else ignorar += 1;
    }
    return { atualizar, criar, ignorar };
  }, [vinculos]);

  const valorTotal = useMemo(() => ITENS_MOCK.reduce((acc, i) => acc + i.valorTotal, 0), []);

  const handleChangeVinculo = (itemId: string, next: Vinculo) => {
    setVinculos((prev) => ({ ...prev, [itemId]: next }));
    if (next !== 'match') {
      setSkus((prev) => {
        const n = { ...prev };
        delete n[itemId];
        return n;
      });
    }
  };

  const handleChangeSku = (itemId: string, sku: string) => {
    setSkus((prev) => ({ ...prev, [itemId]: sku }));
    setVinculos((prev) => ({ ...prev, [itemId]: 'match' }));
  };

  const handleConfirmar = () => {
    setConfirmOpen(false);
    toast.success('Importação concluída. Estoque atualizado.');
    router.push('/estoque');
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/importar">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revisão de Importação</h1>
          <p className="text-muted-foreground">
            Confira o matching automático entre os itens do XML e seu catálogo.
          </p>
        </div>

        {/* Cards horizontais com metadata */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetaCard label="Arquivo" value={`#${id}`} mono />
          <MetaCard label="Fornecedor" value="Distribuidora Sul Brasil LTDA" />
          <MetaCard label="Data emissão" value="12/04/2026" />
          <MetaCard label="Valor total" value={<Money value={valorTotal} />} />
          <MetaCard label="Itens" value={String(ITENS_MOCK.length)} />
        </div>

        <Stepper current={3} />
      </div>

      {/* Tabela de itens */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Descrição (XML)</th>
                <th className="px-4 py-3 font-semibold">NCM</th>
                <th className="px-4 py-3 text-center font-semibold">UN</th>
                <th className="px-4 py-3 text-right font-semibold">Qtd</th>
                <th className="px-4 py-3 text-right font-semibold">Valor unit</th>
                <th className="px-4 py-3 text-right font-semibold">Valor total</th>
                <th className="px-4 py-3 font-semibold">Vínculo</th>
              </tr>
            </thead>
            <tbody>
              {ITENS_MOCK.map((item) => {
                const v: Vinculo = vinculos[item.id] ?? 'ignorar';
                const bg =
                  v === 'match'
                    ? 'bg-brand-green/5'
                    : v === 'novo'
                      ? 'bg-brand-warning/5'
                      : 'bg-muted/30';
                return (
                  <tr key={item.id} className={cn('border-b last:border-0', bg)}>
                    <td className="px-4 py-3 align-middle">
                      <div className="font-medium">{item.descricaoXml}</div>
                      {v === 'match' && skus[item.id] ? (
                        <div className="text-xs text-brand-green">
                          ✓ Vinculado a {skus[item.id]}
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
                      {item.quantidade}
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <Money value={item.valorUnit} />
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <Money value={item.valorTotal} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <VinculoSelect
                        vinculo={v}
                        skuSelecionado={skus[item.id]}
                        onChangeVinculo={(next) => handleChangeVinculo(item.id, next)}
                        onChangeSku={(sku) => handleChangeSku(item.id, sku)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Rodapé fixo sticky */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto flex flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge
              variant="secondary"
              className="bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
            >
              {totais.atualizar} {totais.atualizar === 1 ? 'atualizado' : 'atualizados'}
            </Badge>
            <Badge
              variant="secondary"
              className="bg-brand-warning/10 text-brand-warning hover:bg-brand-warning/20"
            >
              {totais.criar} a criar
            </Badge>
            <Badge variant="secondary">
              {totais.ignorar} {totais.ignorar === 1 ? 'ignorado' : 'ignorados'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/importar">Cancelar</Link>
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>Confirmar importação →</Button>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importação</DialogTitle>
            <DialogDescription>
              Isto vai atualizar {totais.atualizar}{' '}
              {totais.atualizar === 1 ? 'produto' : 'produtos'} e criar {totais.criar}{' '}
              {totais.criar === 1 ? 'novo' : 'novos'} no cadastro. Continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
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
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
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
    <div
      className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-card p-3"
      aria-label="Etapas da importação"
    >
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
                isActive && 'font-semibold text-foreground',
                isDone && 'text-brand-green',
                !isActive && !isDone && 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 ? (
              <div
                className={cn('h-px w-6 shrink-0 sm:w-12', isDone ? 'bg-brand-green' : 'bg-border')}
                aria-hidden
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
  skuSelecionado,
  onChangeVinculo,
  onChangeSku,
}: {
  vinculo: Vinculo;
  skuSelecionado: string | undefined;
  onChangeVinculo: (v: Vinculo) => void;
  onChangeSku: (sku: string) => void;
}) {
  // Select composto: valor "match:SKU" / "novo" / "ignorar"
  const value = vinculo === 'match' && skuSelecionado ? `match:${skuSelecionado}` : vinculo;

  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (v.startsWith('match:')) {
          const sku = v.slice('match:'.length);
          if (sku) onChangeSku(sku);
        } else if (v === 'novo') {
          onChangeVinculo('novo');
        } else {
          onChangeVinculo('ignorar');
        }
      }}
      className={cn(
        'h-9 min-w-[240px] rounded-md border border-input bg-background px-2 text-xs',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label="Vínculo do item"
    >
      <optgroup label="Vincular a produto existente">
        {CATALOGO.map((p) => (
          <option key={p.id} value={`match:${p.sku}`}>
            ✓ {p.descricao} ({p.sku})
          </option>
        ))}
      </optgroup>
      <option value="novo">+ Criar novo produto</option>
      <option value="ignorar">✗ Ignorar este item</option>
    </select>
  );
}
