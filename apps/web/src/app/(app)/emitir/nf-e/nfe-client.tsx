'use client';

import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { brlToNumber, numberToBRL } from '@/components/forms/masks';
import { UfSelect } from '@/components/forms/uf-select';
import {
  type Cliente,
  type Fornecedor,
  type Produto,
  clientes as fixtureClientes,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Money,
  Separator,
  cn,
} from '@nexo/ui';
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FilePlus,
  FileText,
  Loader2,
  Mail,
  Package,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Truck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type TabId = 'destinatario' | 'produtos' | 'transporte' | 'pagamento' | 'adicionais';

interface Item {
  uid: string;
  produto: Produto;
  qtd: number;
  valorUnit: number;
  desconto: number;
  cfop: string;
  cst: string;
  aliquotaIcms: number;
  aliquotaPis: number;
  aliquotaCofins: number;
}

const TABS: Array<{ id: TabId; label: string; icon: typeof User }> = [
  { id: 'destinatario', label: 'Destinatário', icon: User },
  { id: 'produtos', label: 'Produtos', icon: Package },
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'pagamento', label: 'Pagamento', icon: Wallet },
  { id: 'adicionais', label: 'Informações adicionais', icon: FileText },
];

const MODALIDADES_FRETE = [
  { value: '9', label: '9 - Sem frete' },
  { value: '0', label: '0 - Emitente' },
  { value: '1', label: '1 - Destinatário' },
  { value: '2', label: '2 - Terceiros' },
  { value: '3', label: '3 - Próprio remetente' },
  { value: '4', label: '4 - Próprio destinatário' },
];

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'prazo', label: 'A prazo' },
  { value: 'sem', label: 'Sem pagamento' },
] as const;
type FormaPag = (typeof FORMAS_PAGAMENTO)[number]['value'];

function chaveAcessoMock(numero: string) {
  const base = `3526041234567800019055001${numero.padStart(9, '0')}${'109876543210'.slice(0, 10)}`;
  // 44 dígitos — formata em grupos de 4
  const digits = base.padEnd(44, '0').slice(0, 44);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function NfeClient() {
  const [activeTab, setActiveTab] = useState<TabId>('destinatario');

  // Destinatário
  const [clienteBusca, setClienteBusca] = useState('');
  const [cliente, setCliente] = useState<Cliente | null>(null);

  // Produtos
  const [produtoBusca, setProdutoBusca] = useState('');
  const [itens, setItens] = useState<Item[]>([]);

  // Transporte
  const [modalidadeFrete, setModalidadeFrete] = useState('9');
  const [transportadoraBusca, setTransportadoraBusca] = useState('');
  const [transportadora, setTransportadora] = useState<Fornecedor | null>(null);
  const [placa, setPlaca] = useState('');
  const [ufPlaca, setUfPlaca] = useState('');
  const [volQtd, setVolQtd] = useState('1');
  const [volEspecie, setVolEspecie] = useState('Caixa');
  const [volMarca, setVolMarca] = useState('');
  const [pesoBruto, setPesoBruto] = useState('0,00');
  const [pesoLiquido, setPesoLiquido] = useState('0,00');

  // Pagamento
  const [formaPag, setFormaPag] = useState<FormaPag>('pix');
  const [parcelas, setParcelas] = useState('1');
  const [valorPago, setValorPago] = useState('0,00');

  // Adicionais
  const [infoFisco, setInfoFisco] = useState('');
  const [obsFiscais, setObsFiscais] = useState('');

  // Fluxo transmissão
  const [transmitindo, setTransmitindo] = useState(false);
  const [sucessoOpen, setSucessoOpen] = useState(false);
  const [numeroGerado, setNumeroGerado] = useState('001873');
  const [chaveGerada, setChaveGerada] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const clientesFiltrados = useMemo(() => {
    const term = clienteBusca.trim().toLowerCase();
    if (!term) return fixtureClientes.slice(0, 5);
    return fixtureClientes.filter(
      (c) => c.nome.toLowerCase().includes(term) || c.documento.includes(term),
    );
  }, [clienteBusca]);

  const produtosFiltrados = useMemo(() => {
    const term = produtoBusca.trim().toLowerCase();
    if (!term) return fixtureProdutos;
    return fixtureProdutos.filter(
      (p) => p.descricao.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term),
    );
  }, [produtoBusca]);

  const transportadorasFiltradas = useMemo(() => {
    const term = transportadoraBusca.trim().toLowerCase();
    if (!term) return fixtureFornecedores.slice(0, 5);
    return fixtureFornecedores.filter(
      (f) => f.razaoSocial.toLowerCase().includes(term) || f.cnpj.includes(term),
    );
  }, [transportadoraBusca]);

  const adicionarProduto = (p: Produto) => {
    setItens((prev) => [
      ...prev,
      {
        uid: `${p.id}-${Date.now()}`,
        produto: p,
        qtd: 1,
        valorUnit: p.precoVenda,
        desconto: 0,
        cfop: '5102',
        cst: '00',
        aliquotaIcms: 18,
        aliquotaPis: 1.65,
        aliquotaCofins: 7.6,
      },
    ]);
    setProdutoBusca('');
  };

  const atualizarItem = <K extends keyof Item>(uid: string, field: K, value: Item[K]) => {
    setItens((prev) => prev.map((i) => (i.uid === uid ? { ...i, [field]: value } : i)));
  };

  const removerItem = (uid: string) => {
    setItens((prev) => prev.filter((i) => i.uid !== uid));
  };

  // --- Totais ---
  const totais = useMemo(() => {
    let produtos = 0;
    let descontos = 0;
    let icms = 0;
    let pis = 0;
    let cofins = 0;
    for (const it of itens) {
      const subtotal = it.qtd * it.valorUnit;
      const base = Math.max(0, subtotal - it.desconto);
      produtos += subtotal;
      descontos += it.desconto;
      icms += base * (it.aliquotaIcms / 100);
      pis += base * (it.aliquotaPis / 100);
      cofins += base * (it.aliquotaCofins / 100);
    }
    const baseIcms = Math.max(0, produtos - descontos);
    const total = baseIcms; // simplificação para protótipo
    return {
      produtos,
      descontos,
      baseIcms,
      icms,
      icmsSt: 0,
      ipi: 0,
      pis,
      cofins,
      frete: 0,
      seguro: 0,
      outros: 0,
      total,
      totalItens: itens.reduce((acc, i) => acc + i.qtd, 0),
    };
  }, [itens]);

  const handleSalvarRascunho = () => toast.success('Rascunho salvo (mock)');

  const handleTransmitir = () => {
    if (!cliente) {
      toast.error('Selecione o destinatário.');
      setActiveTab('destinatario');
      return;
    }
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um produto.');
      setActiveTab('produtos');
      return;
    }
    setTransmitindo(true);
    setTimeout(() => {
      setTransmitindo(false);
      const n = 1873 + Math.floor(Math.random() * 30);
      const numero = String(n).padStart(6, '0');
      setNumeroGerado(numero);
      setChaveGerada(chaveAcessoMock(numero));
      setSucessoOpen(true);
    }, 3000);
  };

  const handleNovaNota = () => {
    setSucessoOpen(false);
    setCliente(null);
    setItens([]);
    setActiveTab('destinatario');
    toast.info('Pronto para nova NF-e');
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
          <span className="font-medium text-foreground">NF-e</span>
        </nav>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Emitir NF-e</h1>
            <p className="text-muted-foreground">
              Nota Fiscal eletrônica modelo 55 — transmitida à SEFAZ estadual.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSalvarRascunho}>
              <Save className="mr-2 h-4 w-4" aria-hidden />
              Rascunho
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              Pré-visualizar DANFE
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Coluna principal */}
        <div className="min-w-0 space-y-4">
          {/* Tabs (desktop) — no mobile vira accordion funcional (cada tab sempre visível) */}
          <div className="hidden md:block">
            <div
              role="tablist"
              className="flex gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1"
            >
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      'flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop: mostra apenas a tab ativa */}
          <div className="hidden md:block">
            {activeTab === 'destinatario' ? (
              <DestinatarioSection
                cliente={cliente}
                setCliente={setCliente}
                busca={clienteBusca}
                setBusca={setClienteBusca}
                clientesFiltrados={clientesFiltrados}
              />
            ) : null}
            {activeTab === 'produtos' ? (
              <ProdutosSection
                itens={itens}
                adicionar={adicionarProduto}
                atualizar={atualizarItem}
                remover={removerItem}
                busca={produtoBusca}
                setBusca={setProdutoBusca}
                produtosFiltrados={produtosFiltrados}
              />
            ) : null}
            {activeTab === 'transporte' ? (
              <TransporteSection
                modalidadeFrete={modalidadeFrete}
                setModalidadeFrete={setModalidadeFrete}
                transportadora={transportadora}
                setTransportadora={setTransportadora}
                transportadoraBusca={transportadoraBusca}
                setTransportadoraBusca={setTransportadoraBusca}
                transportadorasFiltradas={transportadorasFiltradas}
                placa={placa}
                setPlaca={setPlaca}
                ufPlaca={ufPlaca}
                setUfPlaca={setUfPlaca}
                volQtd={volQtd}
                setVolQtd={setVolQtd}
                volEspecie={volEspecie}
                setVolEspecie={setVolEspecie}
                volMarca={volMarca}
                setVolMarca={setVolMarca}
                pesoBruto={pesoBruto}
                setPesoBruto={setPesoBruto}
                pesoLiquido={pesoLiquido}
                setPesoLiquido={setPesoLiquido}
              />
            ) : null}
            {activeTab === 'pagamento' ? (
              <PagamentoSection
                formaPag={formaPag}
                setFormaPag={setFormaPag}
                parcelas={parcelas}
                setParcelas={setParcelas}
                valorPago={valorPago}
                setValorPago={setValorPago}
                totalNota={totais.total}
              />
            ) : null}
            {activeTab === 'adicionais' ? (
              <AdicionaisSection
                infoFisco={infoFisco}
                setInfoFisco={setInfoFisco}
                obsFiscais={obsFiscais}
                setObsFiscais={setObsFiscais}
              />
            ) : null}
          </div>

          {/* Mobile: accordion com todas as seções empilhadas */}
          <div className="space-y-3 md:hidden">
            {TABS.map((t) => (
              <MobileAccordion key={t.id} tab={t}>
                {t.id === 'destinatario' ? (
                  <DestinatarioSection
                    cliente={cliente}
                    setCliente={setCliente}
                    busca={clienteBusca}
                    setBusca={setClienteBusca}
                    clientesFiltrados={clientesFiltrados}
                  />
                ) : null}
                {t.id === 'produtos' ? (
                  <ProdutosSection
                    itens={itens}
                    adicionar={adicionarProduto}
                    atualizar={atualizarItem}
                    remover={removerItem}
                    busca={produtoBusca}
                    setBusca={setProdutoBusca}
                    produtosFiltrados={produtosFiltrados}
                  />
                ) : null}
                {t.id === 'transporte' ? (
                  <TransporteSection
                    modalidadeFrete={modalidadeFrete}
                    setModalidadeFrete={setModalidadeFrete}
                    transportadora={transportadora}
                    setTransportadora={setTransportadora}
                    transportadoraBusca={transportadoraBusca}
                    setTransportadoraBusca={setTransportadoraBusca}
                    transportadorasFiltradas={transportadorasFiltradas}
                    placa={placa}
                    setPlaca={setPlaca}
                    ufPlaca={ufPlaca}
                    setUfPlaca={setUfPlaca}
                    volQtd={volQtd}
                    setVolQtd={setVolQtd}
                    volEspecie={volEspecie}
                    setVolEspecie={setVolEspecie}
                    volMarca={volMarca}
                    setVolMarca={setVolMarca}
                    pesoBruto={pesoBruto}
                    setPesoBruto={setPesoBruto}
                    pesoLiquido={pesoLiquido}
                    setPesoLiquido={setPesoLiquido}
                  />
                ) : null}
                {t.id === 'pagamento' ? (
                  <PagamentoSection
                    formaPag={formaPag}
                    setFormaPag={setFormaPag}
                    parcelas={parcelas}
                    setParcelas={setParcelas}
                    valorPago={valorPago}
                    setValorPago={setValorPago}
                    totalNota={totais.total}
                  />
                ) : null}
                {t.id === 'adicionais' ? (
                  <AdicionaisSection
                    infoFisco={infoFisco}
                    setInfoFisco={setInfoFisco}
                    obsFiscais={obsFiscais}
                    setObsFiscais={setObsFiscais}
                  />
                ) : null}
              </MobileAccordion>
            ))}
          </div>
        </div>

        {/* Coluna lateral */}
        <aside className="order-last lg:order-none">
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Totais da NF-e</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <TotalLine label="Valor produtos" value={totais.produtos} />
                <TotalLine label="Desconto total" value={-totais.descontos} />
                <TotalLine label="Frete" value={totais.frete} />
                <TotalLine label="Seguro" value={totais.seguro} />
                <TotalLine label="Outros" value={totais.outros} />
                <Separator />
                <TotalLine label="Base ICMS" value={totais.baseIcms} muted />
                <TotalLine label="ICMS" value={totais.icms} muted />
                <TotalLine label="ICMS ST" value={totais.icmsSt} muted />
                <TotalLine label="IPI" value={totais.ipi} muted />
                <TotalLine label="PIS" value={totais.pis} muted />
                <TotalLine label="COFINS" value={totais.cofins} muted />
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Total da nota</span>
                  <Money
                    value={totais.total}
                    className="text-2xl font-bold tracking-tight text-brand-blue"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {itens.length} produto{itens.length === 1 ? '' : 's'} · {totais.totalItens} iten
                  {totais.totalItens === 1 ? '' : 's'}
                </div>
                <div className="space-y-2 pt-2">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleTransmitir}
                    disabled={transmitindo}
                  >
                    {transmitindo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    {transmitindo ? 'Transmitindo…' : 'Transmitir SEFAZ'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Ao transmitir, a NF-e é enviada à SEFAZ estadual.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* Loading dialog */}
      <Dialog open={transmitindo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transmitindo à SEFAZ…</DialogTitle>
            <DialogDescription>
              Assinando XML e enviando para autorização (mock 3s).
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-10 w-10 animate-spin text-brand-blue" aria-hidden />
          </div>
        </DialogContent>
      </Dialog>

      {/* Sucesso */}
      <Dialog open={sucessoOpen} onOpenChange={setSucessoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-status-autorizada/10">
              <CheckCircle2 className="h-6 w-6 text-status-autorizada" aria-hidden />
            </div>
            <DialogTitle>NF-e {numeroGerado} autorizada</DialogTitle>
            <DialogDescription>
              Autorizada pela SEFAZ e disponível em Documentos Fiscais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Chave de acesso</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(chaveGerada.replace(/\s/g, ''));
                    toast.success('Chave copiada');
                  }}
                >
                  <Copy className="mr-1.5 h-3 w-3" aria-hidden />
                  Copiar
                </Button>
              </div>
              <div className="mt-1 break-all font-mono text-xs font-semibold tracking-wider">
                {chaveGerada}
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destinatário</span>
                <span className="font-medium">{cliente?.nome ?? '—'}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <Money value={totais.total} className="font-semibold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => toast.success('DANFE gerada (mock)')}>
                <FileText className="mr-2 h-4 w-4" aria-hidden />
                Gerar DANFE
              </Button>
              <Button variant="outline" onClick={() => toast.success('XML baixado (mock)')}>
                <Download className="mr-2 h-4 w-4" aria-hidden />
                Baixar XML
              </Button>
              <Button variant="outline" onClick={() => toast.success('E-mail enviado (mock)')}>
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                Enviar por e-mail
              </Button>
              <Button onClick={handleNovaNota}>
                <FilePlus className="mr-2 h-4 w-4" aria-hidden />
                Nova nota
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview DANFE */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da DANFE</DialogTitle>
            <DialogDescription>Representação visual da NF-e antes de transmitir.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-card p-6 font-mono text-xs">
            <div className="mb-3 border-b pb-3 text-center">
              <div className="font-bold">DANFE — Documento Auxiliar da NF-e</div>
              <div>Modelo 55 · Série 1</div>
            </div>
            <div className="space-y-1">
              <div>
                <strong>Destinatário:</strong> {cliente?.nome ?? '—'}
              </div>
              <div>
                <strong>Itens:</strong> {itens.length} ({totais.totalItens} unidades)
              </div>
              <div>
                <strong>Base ICMS:</strong> R$ {numberToBRL(totais.baseIcms)}
              </div>
              <div>
                <strong>ICMS:</strong> R$ {numberToBRL(totais.icms)}
              </div>
              <div>
                <strong>PIS:</strong> R$ {numberToBRL(totais.pis)}
              </div>
              <div>
                <strong>COFINS:</strong> R$ {numberToBRL(totais.cofins)}
              </div>
              <div className="mt-2 border-t pt-2 text-sm font-bold">
                VALOR TOTAL: R$ {numberToBRL(totais.total)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Subcomponents
// ============================================================================

function TotalLine({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div
      className={cn('flex items-center justify-between text-sm', muted && 'text-muted-foreground')}
    >
      <span>{label}</span>
      <Money value={value} hideCurrency className="font-medium" />
    </div>
  );
}

function MobileAccordion({
  tab,
  children,
}: {
  tab: (typeof TABS)[number];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(tab.id === 'destinatario');
  const Icon = tab.icon;
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" aria-hidden />
          {tab.label}
        </span>
        <ChevronRight
          className={cn('h-4 w-4 transition-transform', open && 'rotate-90')}
          aria-hidden
        />
      </button>
      {open ? <div className="border-t p-3">{children}</div> : null}
    </div>
  );
}

function DestinatarioSection({
  cliente,
  setCliente,
  busca,
  setBusca,
  clientesFiltrados,
}: {
  cliente: Cliente | null;
  setCliente: (c: Cliente | null) => void;
  busca: string;
  setBusca: (v: string) => void;
  clientesFiltrados: Cliente[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Destinatário</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou CPF/CNPJ..."
            className="pl-9"
            aria-label="Buscar destinatário"
          />
          {busca && clientesFiltrados.length > 0 && !cliente ? (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {clientesFiltrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCliente(c);
                    setBusca('');
                  }}
                  className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{c.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.tipo} · {c.documento}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {c.uf}
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info('Abra o cadastro completo em Cadastros › Clientes')}
            type="button"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Novo cliente
          </Button>
        </div>
        {cliente ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{cliente.nome}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {cliente.tipo} · {cliente.documento}
                </div>
                {cliente.email ? (
                  <div className="mt-1 text-xs text-muted-foreground">{cliente.email}</div>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary">
                  {cliente.cidade}/{cliente.uf}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setCliente(null)} type="button">
                  <X className="mr-1 h-3 w-3" aria-hidden />
                  Trocar
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProdutosSection({
  itens,
  adicionar,
  atualizar,
  remover,
  busca,
  setBusca,
  produtosFiltrados,
}: {
  itens: Item[];
  adicionar: (p: Produto) => void;
  atualizar: <K extends keyof Item>(uid: string, field: K, value: Item[K]) => void;
  remover: (uid: string) => void;
  busca: string;
  setBusca: (v: string) => void;
  produtosFiltrados: Produto[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Produtos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto por SKU ou descrição..."
            className="pl-9"
            aria-label="Buscar produto"
          />
          {busca && produtosFiltrados.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
              {produtosFiltrados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => adicionar(p)}
                  className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{p.descricao}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                  </div>
                  <Money value={p.precoVenda} className="shrink-0 text-xs" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {itens.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden />
            Nenhum produto adicionado. Use a busca acima.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/50 text-left uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-semibold">Produto</th>
                  <th className="px-2 py-2 text-right font-semibold">Qtd</th>
                  <th className="px-2 py-2 text-right font-semibold">Valor</th>
                  <th className="px-2 py-2 text-right font-semibold">Desc.</th>
                  <th className="px-2 py-2 font-semibold">CFOP</th>
                  <th className="px-2 py-2 font-semibold">CST</th>
                  <th className="px-2 py-2 text-right font-semibold">ICMS%</th>
                  <th className="px-2 py-2 text-right font-semibold">PIS%</th>
                  <th className="px-2 py-2 text-right font-semibold">COFINS%</th>
                  <th className="px-2 py-2 text-right font-semibold">Total</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => {
                  const total = Math.max(0, it.qtd * it.valorUnit - it.desconto);
                  return (
                    <tr key={it.uid} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <div className="font-medium">{it.produto.descricao}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {it.produto.sku}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <NumericCell
                          value={it.qtd}
                          onChange={(v) => atualizar(it.uid, 'qtd', Math.max(1, v))}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <NumericCell
                          value={it.valorUnit}
                          onChange={(v) => atualizar(it.uid, 'valorUnit', v)}
                          decimals
                        />
                      </td>
                      <td className="px-2 py-2">
                        <NumericCell
                          value={it.desconto}
                          onChange={(v) => atualizar(it.uid, 'desconto', v)}
                          decimals
                        />
                      </td>
                      <td className="px-2 py-2">
                        <TextCell value={it.cfop} onChange={(v) => atualizar(it.uid, 'cfop', v)} />
                      </td>
                      <td className="px-2 py-2">
                        <TextCell value={it.cst} onChange={(v) => atualizar(it.uid, 'cst', v)} />
                      </td>
                      <td className="px-2 py-2">
                        <NumericCell
                          value={it.aliquotaIcms}
                          onChange={(v) => atualizar(it.uid, 'aliquotaIcms', v)}
                          decimals
                        />
                      </td>
                      <td className="px-2 py-2">
                        <NumericCell
                          value={it.aliquotaPis}
                          onChange={(v) => atualizar(it.uid, 'aliquotaPis', v)}
                          decimals
                        />
                      </td>
                      <td className="px-2 py-2">
                        <NumericCell
                          value={it.aliquotaCofins}
                          onChange={(v) => atualizar(it.uid, 'aliquotaCofins', v)}
                          decimals
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Money value={total} hideCurrency className="font-semibold" />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remover(it.uid)}
                          aria-label="Remover item"
                        >
                          <Trash2 className="h-4 w-4 text-brand-danger" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {itens.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            {itens.length} produto{itens.length === 1 ? '' : 's'} ·{' '}
            {itens.reduce((acc, i) => acc + i.qtd, 0)} itens
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NumericCell({
  value,
  onChange,
  decimals,
}: {
  value: number;
  onChange: (v: number) => void;
  decimals?: boolean;
}) {
  return (
    <input
      type="number"
      step={decimals ? '0.01' : '1'}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-8 w-20 rounded border border-input bg-background px-2 text-right text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function TextCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-16 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

function TransporteSection(props: {
  modalidadeFrete: string;
  setModalidadeFrete: (v: string) => void;
  transportadora: Fornecedor | null;
  setTransportadora: (f: Fornecedor | null) => void;
  transportadoraBusca: string;
  setTransportadoraBusca: (v: string) => void;
  transportadorasFiltradas: Fornecedor[];
  placa: string;
  setPlaca: (v: string) => void;
  ufPlaca: string;
  setUfPlaca: (v: string) => void;
  volQtd: string;
  setVolQtd: (v: string) => void;
  volEspecie: string;
  setVolEspecie: (v: string) => void;
  volMarca: string;
  setVolMarca: (v: string) => void;
  pesoBruto: string;
  setPesoBruto: (v: string) => void;
  pesoLiquido: string;
  setPesoLiquido: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transporte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField label="Modalidade do frete" htmlFor="mod-frete">
          <select
            id="mod-frete"
            value={props.modalidadeFrete}
            onChange={(e) => props.setModalidadeFrete(e.target.value)}
            className={cn(
              'h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {MODALIDADES_FRETE.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Transportadora" htmlFor="transp">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="transp"
              value={props.transportadoraBusca}
              onChange={(e) => props.setTransportadoraBusca(e.target.value)}
              placeholder="Buscar fornecedor para transporte..."
              className="pl-9"
            />
            {props.transportadoraBusca && !props.transportadora ? (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                {props.transportadorasFiltradas.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      props.setTransportadora(f);
                      props.setTransportadoraBusca('');
                    }}
                    className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                  >
                    <div>
                      <div className="font-medium">{f.razaoSocial}</div>
                      <div className="font-mono text-xs text-muted-foreground">{f.cnpj}</div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {f.uf}
                    </Badge>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => toast.info('Cadastro de transportadora (mock)')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand-blue hover:bg-muted/50"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Criar nova transportadora
                </button>
              </div>
            ) : null}
          </div>
        </FormField>

        {props.transportadora ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{props.transportadora.razaoSocial}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {props.transportadora.cnpj}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.setTransportadora(null)}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <FormField label="Placa do veículo" htmlFor="placa">
            <Input
              id="placa"
              value={props.placa}
              onChange={(e) => props.setPlaca(e.target.value.toUpperCase())}
              placeholder="ABC1D23"
              maxLength={7}
              className="font-mono uppercase"
            />
          </FormField>
          <FormField label="UF da placa" htmlFor="uf-placa">
            <UfSelect id="uf-placa" value={props.ufPlaca} onChange={props.setUfPlaca} />
          </FormField>
        </div>

        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Volumes
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Quantidade" htmlFor="vol-qtd">
              <Input
                id="vol-qtd"
                type="number"
                min="0"
                value={props.volQtd}
                onChange={(e) => props.setVolQtd(e.target.value)}
              />
            </FormField>
            <FormField label="Espécie" htmlFor="vol-esp">
              <Input
                id="vol-esp"
                value={props.volEspecie}
                onChange={(e) => props.setVolEspecie(e.target.value)}
              />
            </FormField>
            <FormField label="Marca" htmlFor="vol-marca">
              <Input
                id="vol-marca"
                value={props.volMarca}
                onChange={(e) => props.setVolMarca(e.target.value)}
              />
            </FormField>
            <FormField label="Peso bruto (kg)" htmlFor="vol-pb">
              <MaskedInput
                id="vol-pb"
                mask="brl"
                value={props.pesoBruto}
                onChange={props.setPesoBruto}
              />
            </FormField>
            <FormField label="Peso líquido (kg)" htmlFor="vol-pl">
              <MaskedInput
                id="vol-pl"
                mask="brl"
                value={props.pesoLiquido}
                onChange={props.setPesoLiquido}
              />
            </FormField>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

function PagamentoSection({
  formaPag,
  setFormaPag,
  parcelas,
  setParcelas,
  valorPago,
  setValorPago,
  totalNota,
}: {
  formaPag: FormaPag;
  setFormaPag: (v: FormaPag) => void;
  parcelas: string;
  setParcelas: (v: string) => void;
  valorPago: string;
  setValorPago: (v: string) => void;
  totalNota: number;
}) {
  const valorPagoNum = brlToNumber(valorPago);
  const troco = Math.max(0, valorPagoNum - totalNota);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField label="Forma de pagamento" htmlFor="forma-pag">
          <select
            id="forma-pag"
            value={formaPag}
            onChange={(e) => setFormaPag(e.target.value as FormaPag)}
            className={cn(
              'h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </FormField>

        {formaPag === 'prazo' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Parcelas" htmlFor="parcelas">
              <select
                id="parcelas"
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
                className={cn(
                  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
                )}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Valor por parcela" htmlFor="vlr-parcela">
              <Input
                id="vlr-parcela"
                value={numberToBRL(totalNota / (Number.parseInt(parcelas, 10) || 1))}
                readOnly
                className="bg-muted/40 font-mono tabular-nums"
              />
            </FormField>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Valor pago (R$)" htmlFor="vlr-pago">
            <MaskedInput id="vlr-pago" mask="brl" value={valorPago} onChange={setValorPago} />
          </FormField>
          <FormField label="Troco" htmlFor="troco">
            <div
              id="troco"
              className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm"
            >
              <Money value={troco} />
            </div>
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}

function AdicionaisSection({
  infoFisco,
  setInfoFisco,
  obsFiscais,
  setObsFiscais,
}: {
  infoFisco: string;
  setInfoFisco: (v: string) => void;
  obsFiscais: string;
  setObsFiscais: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informações adicionais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField label="Observações fiscais" htmlFor="obs-fis">
          <textarea
            id="obs-fis"
            value={obsFiscais}
            onChange={(e) => setObsFiscais(e.target.value)}
            rows={3}
            placeholder="Observações exibidas na DANFE..."
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
        </FormField>
        <FormField label="Informações ao fisco" htmlFor="info-fis">
          <textarea
            id="info-fis"
            value={infoFisco}
            onChange={(e) => setInfoFisco(e.target.value)}
            rows={3}
            placeholder="Informações de interesse exclusivo do fisco..."
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
        </FormField>
      </CardContent>
    </Card>
  );
}
