'use client';

import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { brlToNumber, numberToBRL } from '@/components/forms/masks';
import {
  type Cliente,
  type Servico,
  clientes as fixtureClientes,
  servicos as fixtureServicos,
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
  Plus,
  Save,
  Search,
  Send,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type LocalPrestacao = 'prestador' | 'tomador' | 'outro';

interface RetencaoState {
  ativa: boolean;
  aliquota: string; // BRL-like percent string e.g. "1,50"
}

const RETENCOES_LABELS = {
  ir: 'IR',
  inss: 'INSS',
  pis: 'PIS',
  cofins: 'COFINS',
  csll: 'CSLL',
} as const;
type RetencaoKey = keyof typeof RETENCOES_LABELS;

export function NfseClient() {
  // Tomador
  const [clienteBusca, setClienteBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);

  // Serviço
  const [servicoBusca, setServicoBusca] = useState('');
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);
  const [descricaoComplementar, setDescricaoComplementar] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [valorUnitario, setValorUnitario] = useState('0,00');
  const [desconto, setDesconto] = useState('0,00');

  // Tributação
  const [issRetido, setIssRetido] = useState<'sim' | 'nao'>('nao');
  const [aliquotaIss, setAliquotaIss] = useState('5,00');
  const [retencoesOpen, setRetencoesOpen] = useState(false);
  const [retencoes, setRetencoes] = useState<Record<RetencaoKey, RetencaoState>>({
    ir: { ativa: false, aliquota: '1,50' },
    inss: { ativa: false, aliquota: '11,00' },
    pis: { ativa: false, aliquota: '0,65' },
    cofins: { ativa: false, aliquota: '3,00' },
    csll: { ativa: false, aliquota: '1,00' },
  });

  // Adicionais
  const [localPrestacao, setLocalPrestacao] = useState<LocalPrestacao>('prestador');
  const [dataCompetencia, setDataCompetencia] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState('');

  // Fluxo de transmissão
  const [transmitindo, setTransmitindo] = useState(false);
  const [sucessoOpen, setSucessoOpen] = useState(false);
  const [numeroGerado, setNumeroGerado] = useState('000249');
  const [codigoVerificacao, setCodigoVerificacao] = useState('A7K2-M9P4');
  const [previewOpen, setPreviewOpen] = useState(false);

  const clientesFiltrados = useMemo(() => {
    const term = clienteBusca.trim().toLowerCase();
    if (!term) return fixtureClientes.slice(0, 5);
    return fixtureClientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.documento.includes(term) ||
        (c.email?.toLowerCase().includes(term) ?? false),
    );
  }, [clienteBusca]);

  const servicosFiltrados = useMemo(() => {
    const term = servicoBusca.trim().toLowerCase();
    if (!term) return fixtureServicos;
    return fixtureServicos.filter(
      (s) =>
        s.descricao.toLowerCase().includes(term) ||
        s.codigo.toLowerCase().includes(term) ||
        s.codigoMunicipal.includes(term),
    );
  }, [servicoBusca]);

  // --- Cálculos ---
  const qtdNum = Math.max(1, Number.parseInt(quantidade || '1', 10) || 1);
  const valorUnitNum = brlToNumber(valorUnitario);
  const descontoNum = brlToNumber(desconto);
  const aliquotaNum = brlToNumber(aliquotaIss);

  const valorServico = qtdNum * valorUnitNum;
  const baseCalculo = Math.max(0, valorServico - descontoNum);
  const issValor = baseCalculo * (aliquotaNum / 100);

  const totalRetencoes = useMemo(() => {
    let total = 0;
    for (const key of Object.keys(retencoes) as RetencaoKey[]) {
      const r = retencoes[key];
      if (r.ativa) total += baseCalculo * (brlToNumber(r.aliquota) / 100);
    }
    return total;
  }, [retencoes, baseCalculo]);

  const valorLiquido = baseCalculo - (issRetido === 'sim' ? issValor : 0) - totalRetencoes;

  const handleSelecionarServico = (s: Servico) => {
    setServicoSelecionado(s);
    setServicoBusca('');
    setValorUnitario(numberToBRL(s.precoPadrao));
    setAliquotaIss(numberToBRL(s.aliquotaIss));
  };

  const handleSalvarRascunho = () => {
    toast.success('Rascunho salvo (mock)');
  };

  const handleTransmitir = () => {
    if (!clienteSelecionado) {
      toast.error('Selecione o tomador do serviço.');
      return;
    }
    if (!servicoSelecionado) {
      toast.error('Selecione o serviço prestado.');
      return;
    }
    if (valorServico <= 0) {
      toast.error('Informe quantidade e valor do serviço.');
      return;
    }
    setTransmitindo(true);
    setTimeout(() => {
      setTransmitindo(false);
      // Gera número sequencial simulado
      const n = 249 + Math.floor(Math.random() * 20);
      setNumeroGerado(String(n).padStart(6, '0'));
      setCodigoVerificacao(
        `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`,
      );
      setSucessoOpen(true);
    }, 2000);
  };

  const handleNovaNota = () => {
    setSucessoOpen(false);
    setClienteSelecionado(null);
    setServicoSelecionado(null);
    setDescricaoComplementar('');
    setQuantidade('1');
    setValorUnitario('0,00');
    setDesconto('0,00');
    setObservacoes('');
    setIssRetido('nao');
    toast.info('Pronto para nova NFS-e');
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
          <span className="font-medium text-foreground">NFS-e</span>
        </nav>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Emitir NFS-e</h1>
            <p className="text-muted-foreground">
              Nota Fiscal de Serviço eletrônica — transmitida à prefeitura do prestador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSalvarRascunho}>
              <Save className="mr-2 h-4 w-4" aria-hidden />
              Salvar rascunho
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              Pré-visualizar DANFSE
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Coluna principal — formulário */}
        <div className="min-w-0 space-y-4">
          {/* Tomador */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tomador do serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={clienteBusca}
                  onChange={(e) => setClienteBusca(e.target.value)}
                  placeholder="Buscar cliente por nome, CPF/CNPJ ou e-mail..."
                  className="pl-9"
                  aria-label="Buscar cliente"
                />
                {clienteBusca && clientesFiltrados.length > 0 && !clienteSelecionado ? (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {clientesFiltrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClienteSelecionado(c);
                          setClienteBusca('');
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNovoClienteOpen(true)}
                  type="button"
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  Novo cliente
                </Button>
                {clienteSelecionado ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setClienteSelecionado(null)}
                    type="button"
                  >
                    <X className="mr-2 h-4 w-4" aria-hidden />
                    Trocar cliente
                  </Button>
                ) : null}
              </div>
              {clienteSelecionado ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{clienteSelecionado.nome}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {clienteSelecionado.tipo} · {clienteSelecionado.documento}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {clienteSelecionado.cidade}/{clienteSelecionado.uf}
                    </Badge>
                  </div>
                  {clienteSelecionado.email ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {clienteSelecionado.email}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Serviço prestado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={servicoBusca}
                  onChange={(e) => setServicoBusca(e.target.value)}
                  placeholder="Buscar serviço por código ou descrição..."
                  className="pl-9"
                  aria-label="Buscar serviço"
                />
                {servicoBusca && servicosFiltrados.length > 0 && !servicoSelecionado ? (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg">
                    {servicosFiltrados.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelecionarServico(s)}
                        className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                      >
                        <div>
                          <div className="font-medium">{s.descricao}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {s.codigo} · LC {s.codigoMunicipal}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          ISS {numberToBRL(s.aliquotaIss)}%
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {servicoSelecionado ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{servicoSelecionado.descricao}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {servicoSelecionado.codigo} · Item LC {servicoSelecionado.codigoMunicipal}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setServicoSelecionado(null)}
                      type="button"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              ) : null}

              <FormField label="Descrição complementar" htmlFor="nfse-descricao">
                <textarea
                  id="nfse-descricao"
                  value={descricaoComplementar}
                  onChange={(e) => setDescricaoComplementar(e.target.value)}
                  rows={3}
                  placeholder="Detalhes do serviço, período, referências..."
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                />
              </FormField>

              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Quantidade" htmlFor="nfse-qtd">
                  <Input
                    id="nfse-qtd"
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    className="tabular-nums"
                  />
                </FormField>
                <FormField label="Valor unitário (R$)" htmlFor="nfse-vu">
                  <MaskedInput
                    id="nfse-vu"
                    mask="brl"
                    value={valorUnitario}
                    onChange={setValorUnitario}
                  />
                </FormField>
                <FormField label="Desconto (R$)" htmlFor="nfse-desc">
                  <MaskedInput id="nfse-desc" mask="brl" value={desconto} onChange={setDesconto} />
                </FormField>
              </div>

              <div className="rounded-md border border-brand-blue/30 bg-brand-blue/5 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Valor do serviço:</span>{' '}
                <Money value={valorServico} className="text-base font-semibold text-brand-blue" />
              </div>
            </CardContent>
          </Card>

          {/* Tributação */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tributação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="mb-1 block text-sm font-medium">ISS retido na fonte?</span>
                <div className="flex gap-2" role="radiogroup" aria-label="ISS retido">
                  {(['nao', 'sim'] as const).map((v) => (
                    <label
                      key={v}
                      className={cn(
                        'flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors',
                        issRetido === v
                          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                          : 'border-input bg-background hover:bg-muted/40',
                      )}
                    >
                      <input
                        type="radio"
                        name="iss-retido"
                        value={v}
                        checked={issRetido === v}
                        onChange={() => setIssRetido(v)}
                        className="sr-only"
                      />
                      {v === 'sim' ? 'Sim' : 'Não'}
                    </label>
                  ))}
                </div>
              </div>

              <FormField
                label="Alíquota ISS (%)"
                htmlFor="nfse-aliq-iss"
                hint="Pré-preenchida conforme o serviço selecionado."
              >
                <MaskedInput
                  id="nfse-aliq-iss"
                  mask="brl"
                  value={aliquotaIss}
                  onChange={setAliquotaIss}
                />
              </FormField>

              {/* Accordion retenções */}
              <div className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setRetencoesOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
                  aria-expanded={retencoesOpen}
                >
                  Retenções (IR, INSS, PIS, COFINS, CSLL)
                  <ChevronRight
                    className={cn('h-4 w-4 transition-transform', retencoesOpen && 'rotate-90')}
                    aria-hidden
                  />
                </button>
                {retencoesOpen ? (
                  <div className="space-y-2 border-t p-3">
                    {(Object.keys(RETENCOES_LABELS) as RetencaoKey[]).map((key) => (
                      <div key={key} className="grid grid-cols-[auto_1fr_120px] items-center gap-3">
                        <input
                          type="checkbox"
                          id={`ret-${key}`}
                          checked={retencoes[key].ativa}
                          onChange={(e) =>
                            setRetencoes((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], ativa: e.target.checked },
                            }))
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                        <label htmlFor={`ret-${key}`} className="text-sm font-medium">
                          {RETENCOES_LABELS[key]}
                        </label>
                        <MaskedInput
                          mask="brl"
                          value={retencoes[key].aliquota}
                          onChange={(v) =>
                            setRetencoes((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], aliquota: v },
                            }))
                          }
                          disabled={!retencoes[key].ativa}
                          aria-label={`Alíquota ${RETENCOES_LABELS[key]} (%)`}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Adicionais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Local da prestação" htmlFor="nfse-local">
                  <select
                    id="nfse-local"
                    value={localPrestacao}
                    onChange={(e) => setLocalPrestacao(e.target.value as LocalPrestacao)}
                    className={cn(
                      'h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <option value="prestador">Município do prestador</option>
                    <option value="tomador">Município do tomador</option>
                    <option value="outro">Outro município</option>
                  </select>
                </FormField>
                <FormField label="Data de competência" htmlFor="nfse-data">
                  <Input
                    id="nfse-data"
                    type="date"
                    value={dataCompetencia}
                    onChange={(e) => setDataCompetencia(e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Observações" htmlFor="nfse-obs">
                <textarea
                  id="nfse-obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={4}
                  placeholder="Campo livre exibido na DANFSE..."
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                />
              </FormField>
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral — resumo */}
        <aside className="order-last lg:order-none">
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo da nota</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ResumoLine label="Valor do serviço" value={valorServico} />
                <ResumoLine label="Desconto" value={-descontoNum} />
                <ResumoLine label="Base de cálculo ISS" value={baseCalculo} />
                <ResumoLine
                  label={`ISS (${numberToBRL(aliquotaNum)}%)`}
                  value={issValor}
                  muted={issRetido === 'nao'}
                />
                <ResumoLine label="Retenções" value={-totalRetencoes} />
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Valor líquido</span>
                  <Money
                    value={valorLiquido}
                    className="text-2xl font-bold tracking-tight text-brand-blue"
                  />
                </div>
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
                  {transmitindo ? 'Transmitindo…' : 'Transmitir para prefeitura'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Ao transmitir, a NFS-e é enviada à prefeitura municipal.
                </p>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>

      {/* Dialog — loading */}
      <Dialog open={transmitindo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectando à prefeitura…</DialogTitle>
            <DialogDescription>
              Transmitindo NFS-e. Isso pode levar alguns segundos (mock 2s).
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-10 w-10 animate-spin text-brand-blue" aria-hidden />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog — sucesso */}
      <Dialog open={sucessoOpen} onOpenChange={setSucessoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-status-autorizada/10">
              <CheckCircle2 className="h-6 w-6 text-status-autorizada" aria-hidden />
            </div>
            <DialogTitle>NFS-e {numeroGerado} autorizada</DialogTitle>
            <DialogDescription>
              A nota foi autorizada pela prefeitura e já está disponível em Documentos Fiscais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Código de verificação</div>
              <div className="mt-1 font-mono text-sm font-semibold tracking-wider">
                {codigoVerificacao}
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tomador</span>
                <span className="font-medium">{clienteSelecionado?.nome ?? '—'}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Valor líquido</span>
                <Money value={valorLiquido} className="font-semibold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => toast.success('PDF da DANFSE baixado (mock)')}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden />
                Baixar PDF
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

      {/* Dialog — preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da DANFSE</DialogTitle>
            <DialogDescription>
              Representação visual da NFS-e. Ainda não transmitida.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-card p-6 font-mono text-xs">
            <div className="mb-3 border-b pb-3 text-center">
              <div className="font-bold">PREFEITURA MUNICIPAL DE SÃO PAULO</div>
              <div>DANFSE — Documento Auxiliar da NFS-e</div>
            </div>
            <div className="space-y-1">
              <div>
                <strong>Tomador:</strong> {clienteSelecionado?.nome ?? '—'}
              </div>
              <div>
                <strong>Serviço:</strong> {servicoSelecionado?.descricao ?? '—'}
              </div>
              <div>
                <strong>Quantidade:</strong> {qtdNum}
              </div>
              <div>
                <strong>Valor unitário:</strong> {numberToBRL(valorUnitNum)}
              </div>
              <div>
                <strong>Desconto:</strong> {numberToBRL(descontoNum)}
              </div>
              <div>
                <strong>Alíquota ISS:</strong> {numberToBRL(aliquotaNum)}%
              </div>
              <div>
                <strong>Valor ISS:</strong> {numberToBRL(issValor)}
              </div>
              <div className="mt-2 border-t pt-2 text-sm font-bold">
                VALOR LÍQUIDO: R$ {numberToBRL(valorLiquido)}
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

      <NovoClienteDialog
        open={novoClienteOpen}
        onOpenChange={setNovoClienteOpen}
        onCreated={(cli) => {
          setClienteSelecionado(cli);
          toast.success(`Cliente "${cli.nome}" criado (mock)`);
        }}
      />
    </div>
  );
}

function ResumoLine({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between text-sm', muted && 'opacity-50')}>
      <span className="text-muted-foreground">{label}</span>
      <Money value={value} />
    </div>
  );
}

function NovoClienteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: Cliente) => void;
}) {
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PJ');
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');

  const reset = () => {
    setTipo('PJ');
    setNome('');
    setDocumento('');
    setEmail('');
  };

  const submit = () => {
    if (!nome || !documento) {
      toast.error('Preencha nome e documento.');
      return;
    }
    onCreated({
      id: `cl-novo-${Date.now()}`,
      tipo,
      documento,
      nome,
      email: email || undefined,
      cidade: 'São Paulo',
      uf: 'SP',
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            Cadastro rápido. Campos completos podem ser ajustados depois em Cadastros.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-sm font-medium">Tipo</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Tipo">
              {(['PF', 'PJ'] as const).map((t) => (
                <label
                  key={t}
                  className={cn(
                    'flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors',
                    tipo === t
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-input bg-background hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name="novo-cli-tipo"
                    value={t}
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="sr-only"
                  />
                  {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </label>
              ))}
            </div>
          </div>
          <FormField label="Nome / Razão social" htmlFor="nc-nome" required>
            <Input id="nc-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </FormField>
          <FormField label={tipo === 'PF' ? 'CPF' : 'CNPJ'} htmlFor="nc-doc" required>
            <MaskedInput
              id="nc-doc"
              mask={tipo === 'PF' ? 'cpf' : 'cnpj'}
              value={documento}
              onChange={setDocumento}
            />
          </FormField>
          <FormField label="E-mail" htmlFor="nc-email">
            <Input
              id="nc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            <Copy className="mr-2 h-4 w-4" aria-hidden />
            Criar e selecionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
