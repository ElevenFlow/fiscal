'use client';

import { Badge, Button, Card, CardContent, cn } from '@nexo/ui';
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type ProcessedStatus = 'ok' | 'fornecedor_novo' | 'invalido';

interface UploadItem {
  id: string;
  nome: string;
  tamanhoKb: number;
  progresso: number;
  estado: 'enviando' | 'processado' | 'erro';
  statusFinal?: ProcessedStatus;
  itens?: number;
  fornecedor?: string;
  mensagemErro?: string;
}

type HistoricoStatus = 'processado' | 'erro' | 'pendente_revisao';

interface XmlHistorico {
  id: string;
  data: string;
  fornecedor: string;
  itens: number;
  status: HistoricoStatus;
  valorTotal: number;
}

const historicoMock: XmlHistorico[] = [
  {
    id: 'xml-h-001',
    data: '17/04/2026 14:32',
    fornecedor: 'Distribuidora Sul Brasil LTDA',
    itens: 23,
    status: 'processado',
    valorTotal: 8420.5,
  },
  {
    id: 'xml-h-002',
    data: '17/04/2026 09:15',
    fornecedor: 'Atacado Central Paulista S/A',
    itens: 41,
    status: 'processado',
    valorTotal: 18320.75,
  },
  {
    id: 'xml-h-003',
    data: '15/04/2026 17:02',
    fornecedor: 'Importadora Oriente LTDA',
    itens: 12,
    status: 'pendente_revisao',
    valorTotal: 4100.0,
  },
  {
    id: 'xml-h-004',
    data: '14/04/2026 11:48',
    fornecedor: 'Distribuidora Sul Brasil LTDA',
    itens: 28,
    status: 'processado',
    valorTotal: 9760.2,
  },
  {
    id: 'xml-h-005',
    data: '12/04/2026 16:20',
    fornecedor: 'Eletro Norte Componentes ME',
    itens: 7,
    status: 'erro',
    valorTotal: 0,
  },
  {
    id: 'xml-h-006',
    data: '10/04/2026 08:55',
    fornecedor: 'Atacado Central Paulista S/A',
    itens: 36,
    status: 'processado',
    valorTotal: 14290.9,
  },
  {
    id: 'xml-h-007',
    data: '08/04/2026 14:10',
    fornecedor: 'Materiais Rio Grande LTDA',
    itens: 19,
    status: 'processado',
    valorTotal: 6820.5,
  },
  {
    id: 'xml-h-008',
    data: '05/04/2026 10:40',
    fornecedor: 'Importadora Oriente LTDA',
    itens: 15,
    status: 'pendente_revisao',
    valorTotal: 5230.0,
  },
  {
    id: 'xml-h-009',
    data: '02/04/2026 13:25',
    fornecedor: 'Distribuidora Sul Brasil LTDA',
    itens: 22,
    status: 'processado',
    valorTotal: 7840.6,
  },
  {
    id: 'xml-h-010',
    data: '28/03/2026 09:50',
    fornecedor: 'Atacado Central Paulista S/A',
    itens: 31,
    status: 'processado',
    valorTotal: 11450.0,
  },
];

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Passos do fluxo de importação. Avança conforme o primeiro upload progride
// — simulação didática; a coleção real não é orquestrada ainda.
const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Leitura' },
  { id: 3, label: 'Revisão' },
  { id: 4, label: 'Confirmação' },
] as const;

// Cenários rotativos para as novas "leituras" — mantêm variedade no mock
const CENARIOS: Array<{
  statusFinal: ProcessedStatus;
  itens: number;
  fornecedor: string;
  mensagemErro?: string;
}> = [
  { statusFinal: 'ok', itens: 23, fornecedor: 'Distribuidora Sul Brasil LTDA' },
  { statusFinal: 'ok', itens: 17, fornecedor: 'Atacado Central Paulista S/A' },
  { statusFinal: 'fornecedor_novo', itens: 9, fornecedor: 'Comercial São Paulo ME (novo)' },
  { statusFinal: 'ok', itens: 34, fornecedor: 'Importadora Oriente LTDA' },
  {
    statusFinal: 'invalido',
    itens: 0,
    fornecedor: '—',
    mensagemErro: 'XML inválido · Schema não reconhecido',
  },
];

function historicoBadge(status: HistoricoStatus) {
  if (status === 'processado') {
    return (
      <Badge
        variant="secondary"
        className="bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
      >
        Processado
      </Badge>
    );
  }
  if (status === 'pendente_revisao') {
    return (
      <Badge
        variant="secondary"
        className="bg-brand-warning/10 text-brand-warning hover:bg-brand-warning/20"
      >
        Revisão pendente
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20"
    >
      Erro
    </Badge>
  );
}

export function ImportarClient() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasProcessing = uploads.some((u) => u.estado === 'enviando');
  const hasAnyDone = uploads.some((u) => u.estado === 'processado');

  // Stepper: avança conforme estado dos uploads
  const currentStep = useMemo(() => {
    if (uploads.length === 0) return 1;
    if (hasProcessing) return 2;
    if (hasAnyDone) return 3;
    return 1;
  }, [uploads.length, hasProcessing, hasAnyDone]);

  // Simula upload + leitura de cada arquivo (progress 0→100 em ~2s)
  const simularUpload = useCallback((itemId: string, cenarioIdx: number) => {
    const tickMs = 80;
    const passos = 25;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      const pct = Math.min(100, Math.round((tick / passos) * 100));
      setUploads((prev) => prev.map((u) => (u.id === itemId ? { ...u, progresso: pct } : u)));
      if (tick >= passos) {
        clearInterval(timer);
        const fallback = CENARIOS[0] ?? {
          statusFinal: 'invalido' as const,
          itens: 0,
          fornecedor: '—',
        };
        const cenario = CENARIOS[cenarioIdx % CENARIOS.length] ?? fallback;
        setUploads((prev) =>
          prev.map((u) =>
            u.id === itemId
              ? {
                  ...u,
                  progresso: 100,
                  estado: cenario.statusFinal === 'invalido' ? 'erro' : 'processado',
                  statusFinal: cenario.statusFinal,
                  itens: cenario.itens,
                  fornecedor: cenario.fornecedor,
                  mensagemErro: cenario.mensagemErro,
                }
              : u,
          ),
        );
        if (cenario.statusFinal !== 'invalido') {
          toast.success(`XML lido: ${cenario.itens} itens identificados`);
        } else {
          toast.error('XML inválido · schema não reconhecido');
        }
      }
    }, tickMs);
  }, []);

  const processarArquivos = useCallback(
    (arquivos: File[]) => {
      if (arquivos.length === 0) return;
      const aceitos = arquivos.slice(0, 10);
      if (arquivos.length > 10) {
        toast.warning('Limite de 10 arquivos simultâneos. Processando os 10 primeiros.');
      }
      const novos: UploadItem[] = aceitos.map((f, idx) => ({
        id: `u-${Date.now()}-${idx}`,
        nome: f.name,
        tamanhoKb: Math.max(1, Math.round(f.size / 1024)),
        progresso: 0,
        estado: 'enviando',
      }));
      setUploads((prev) => [...novos, ...prev]);
      toast.info(
        `${novos.length} ${novos.length === 1 ? 'arquivo recebido' : 'arquivos recebidos'}. Processando...`,
      );
      novos.forEach((item, idx) => simularUpload(item.id, idx));
    },
    [simularUpload],
  );

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    processarArquivos(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processarArquivos(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removerUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar XML de Compra</h1>
        <p className="text-muted-foreground">
          Arraste XMLs de NF-e dos seus fornecedores. O sistema lê automaticamente e sugere
          cadastro/atualização de produtos.
        </p>
      </div>

      {/* Stepper */}
      <Stepper current={currentStep} />

      {/* Layout 2 colunas — colapsa em <1024px */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Painel esquerdo (60%) — Upload */}
        <div className="space-y-4 lg:col-span-3">
          {/* Dropzone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            className={cn(
              'flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card px-6 py-14 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isDragging
                ? 'border-brand-blue bg-brand-blue/5'
                : 'border-border hover:border-brand-blue/60 hover:bg-muted/40',
            )}
          >
            <div
              className={cn(
                'mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-colors',
                isDragging ? 'bg-brand-blue/15 text-brand-blue' : 'bg-muted text-muted-foreground',
              )}
            >
              <Upload className="h-7 w-7" aria-hidden />
            </div>
            <span className="text-base font-semibold">
              Arraste arquivos XML aqui ou clique para selecionar
            </span>
            <span className="mt-1 max-w-md text-xs text-muted-foreground">
              Suporta múltiplos arquivos · até 10MB por arquivo · máx 10 simultâneos
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </button>

          {/* Lista de uploads */}
          {uploads.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Arquivos desta sessão ({uploads.length})
                </h3>
                {!hasProcessing ? (
                  <Button variant="ghost" size="sm" onClick={() => setUploads([])}>
                    Limpar tudo
                  </Button>
                ) : null}
              </div>
              {uploads.map((u) => (
                <UploadCard key={u.id} item={u} onRemove={() => removerUpload(u.id)} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Painel direito (40%) — Histórico */}
        <div className="space-y-3 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold">Últimos XMLs importados</h3>
            <p className="text-xs text-muted-foreground">
              Histórico das importações recentes (30 dias).
            </p>
          </div>
          <div className="space-y-2">
            {historicoMock.map((h) => (
              <HistoricoCard key={h.id} item={h} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-card p-3 text-sm"
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
                isActive && 'text-foreground',
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

function UploadCard({ item, onRemove }: { item: UploadItem; onRemove: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            item.estado === 'enviando' && 'bg-brand-blue/10 text-brand-blue',
            item.statusFinal === 'ok' && 'bg-brand-green/10 text-brand-green',
            item.statusFinal === 'fornecedor_novo' && 'bg-brand-warning/10 text-brand-warning',
            (item.estado === 'erro' || item.statusFinal === 'invalido') &&
              'bg-brand-danger/10 text-brand-danger',
          )}
        >
          {item.estado === 'enviando' ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : item.statusFinal === 'ok' ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          ) : item.statusFinal === 'fornecedor_novo' ? (
            <AlertTriangle className="h-5 w-5" aria-hidden />
          ) : (
            <XCircle className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.nome}</p>
              <p className="text-xs text-muted-foreground">{item.tamanhoKb} KB</p>
            </div>
            {item.estado === 'enviando' ? (
              <span className="tabular-nums text-xs text-muted-foreground">{item.progresso}%</span>
            ) : null}
          </div>

          {item.estado === 'enviando' ? (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-brand-blue transition-all"
                style={{ width: `${item.progresso}%` }}
              />
            </div>
          ) : null}

          {item.statusFinal === 'ok' ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-brand-green">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                Lido com sucesso · {item.itens} itens identificados · Fornecedor: {item.fornecedor}
              </div>
              <Button size="sm" asChild>
                <Link href={`/importar/revisar/xml-mock-${item.id}`}>Revisar →</Link>
              </Button>
            </div>
          ) : null}

          {item.statusFinal === 'fornecedor_novo' ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-brand-warning">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                Fornecedor não cadastrado · {item.fornecedor}
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/importar/revisar/xml-mock-${item.id}`}>Criar e revisar</Link>
              </Button>
            </div>
          ) : null}

          {item.estado === 'erro' || item.statusFinal === 'invalido' ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-brand-danger">
                <XCircle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {item.mensagemErro ?? 'Falha no processamento do XML'}
              </div>
              <Button size="sm" variant="outline" onClick={onRemove}>
                Remover
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function HistoricoCard({ item }: { item: XmlHistorico }) {
  return (
    <Card className="transition-colors hover:bg-muted/40">
      <CardContent className="flex items-start gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-1">
            <p className="truncate text-sm font-medium">{item.fornecedor}</p>
            {historicoBadge(item.status)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{item.data}</span>
            <span aria-hidden>·</span>
            <span>
              {item.itens} {item.itens === 1 ? 'item' : 'itens'}
            </span>
            {item.valorTotal > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono tabular-nums">{formatBRL(item.valorTotal)}</span>
              </>
            ) : null}
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/importar/revisar/${item.id}`}>Ver</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
