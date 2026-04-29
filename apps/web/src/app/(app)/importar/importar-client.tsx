'use client';

import { Badge, Button, Card, CardContent, cn } from '@nexo/ui';
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type UploadState = 'enviando' | 'processado' | 'erro';
type ImportStatus = 'PENDENTE_REVISAO' | 'PROCESSADO' | 'ERRO' | 'DESFEITO';

interface UploadItem {
  id: string;
  nome: string;
  tamanhoKb: number;
  estado: UploadState;
  itens?: number;
  fornecedor?: string;
  mensagemErro?: string;
}

interface XmlImportacao {
  id: string;
  arquivoNome: string;
  fornecedorNome: string;
  status: ImportStatus;
  valorTotal: string;
  itens: Array<unknown>;
  createdAt: string;
}

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Leitura' },
  { id: 3, label: 'Revisao' },
  { id: 4, label: 'Confirmacao' },
] as const;

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ImportarClient() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [historico, setHistorico] = useState<XmlImportacao[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasProcessing = uploads.some((u) => u.estado === 'enviando');
  const hasAnyDone = uploads.some((u) => u.estado === 'processado');
  const currentStep = useMemo(() => {
    if (uploads.length === 0) return 1;
    if (hasProcessing) return 2;
    if (hasAnyDone) return 3;
    return 1;
  }, [uploads.length, hasProcessing, hasAnyDone]);

  const carregarHistorico = useCallback(async () => {
    try {
      const res = await fetch('/api/estoque/importacoes', { cache: 'no-store' });
      if (!res.ok) return;
      setHistorico(await res.json());
    } catch {
      // Historico e suporte visual; falha nao bloqueia upload.
    }
  }, []);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  const processarArquivos = useCallback(
    async (arquivos: File[]) => {
      if (arquivos.length === 0) return;
      const aceitos = arquivos.slice(0, MAX_FILES);
      if (arquivos.length > MAX_FILES) {
        toast.warning('Limite de 10 arquivos simultaneos. Processando os 10 primeiros.');
      }

      for (const [idx, file] of aceitos.entries()) {
        const tempId = `u-${Date.now()}-${idx}`;
        const base = {
          id: tempId,
          nome: file.name,
          tamanhoKb: Math.max(1, Math.round(file.size / 1024)),
        };
        setUploads((prev) => [{ ...base, estado: 'enviando' }, ...prev]);

        if (file.size > MAX_FILE_BYTES) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === tempId
                ? { ...u, estado: 'erro', mensagemErro: 'Arquivo acima do limite de 10MB' }
                : u,
            ),
          );
          continue;
        }

        try {
          const xml = await file.text();
          const res = await fetch('/api/estoque/importacoes/xml', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, xml }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload?.message ?? 'Falha ao importar XML');

          setUploads((prev) =>
            prev.map((u) =>
              u.id === tempId
                ? {
                    ...u,
                    id: payload.id,
                    estado: 'processado',
                    itens: Array.isArray(payload.itens) ? payload.itens.length : 0,
                    fornecedor: payload.fornecedorNome,
                  }
                : u,
            ),
          );
          toast.success(`XML lido: ${payload.fornecedorNome}`);
          void carregarHistorico();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Falha ao processar XML';
          setUploads((prev) =>
            prev.map((u) =>
              u.id === tempId ? { ...u, estado: 'erro', mensagemErro: message } : u,
            ),
          );
          toast.error(message);
        }
      }
    },
    [carregarHistorico],
  );

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    void processarArquivos(Array.from(e.dataTransfer.files ?? []));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    void processarArquivos(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importar XML de Compra</h1>
        <p className="text-muted-foreground">
          Envie XMLs de NF-e de fornecedores para revisar produtos e atualizar o estoque.
        </p>
      </div>

      <Stepper current={currentStep} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
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
              Arraste XMLs aqui ou clique para selecionar
            </span>
            <span className="mt-1 max-w-md text-xs text-muted-foreground">
              Ate 10MB por arquivo, maximo de 10 arquivos simultaneos.
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

          {uploads.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Arquivos desta sessao ({uploads.length})
                </h3>
                {!hasProcessing ? (
                  <Button variant="ghost" size="sm" onClick={() => setUploads([])}>
                    Limpar tudo
                  </Button>
                ) : null}
              </div>
              {uploads.map((item) => (
                <UploadCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold">Ultimos XMLs importados</h3>
            <p className="text-xs text-muted-foreground">Historico recente da empresa atual.</p>
          </div>
          <div className="space-y-2">
            {historico.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Nenhuma importacao registrada ainda.
                </CardContent>
              </Card>
            ) : (
              historico.map((item) => <HistoricoCard key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-lg border bg-card p-3 text-sm">
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
                isDone && 'text-brand-green',
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

function UploadCard({ item }: { item: UploadItem }) {
  const isDone = item.estado === 'processado';
  const isError = item.estado === 'erro';
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            item.estado === 'enviando' && 'bg-brand-blue/10 text-brand-blue',
            isDone && 'bg-brand-green/10 text-brand-green',
            isError && 'bg-brand-danger/10 text-brand-danger',
          )}
        >
          {item.estado === 'enviando' ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : isDone ? (
            <CheckCircle2 className="h-5 w-5" aria-hidden />
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
          </div>
          {item.estado === 'enviando' ? (
            <p className="mt-2 text-xs text-muted-foreground">Lendo XML...</p>
          ) : null}
          {isDone ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-brand-green">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                {item.itens} itens identificados. Fornecedor: {item.fornecedor}
              </div>
              <Button size="sm" asChild>
                <Link href={`/importar/revisar/${item.id}`}>Revisar</Link>
              </Button>
            </div>
          ) : null}
          {isError ? (
            <div className="mt-2 text-xs text-brand-danger">
              <XCircle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {item.mensagemErro ?? 'Falha no processamento do XML'}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function HistoricoCard({ item }: { item: XmlImportacao }) {
  const statusInfo =
    item.status === 'PROCESSADO'
      ? {
          label: 'Processado',
          className: 'bg-brand-green/10 text-brand-green hover:bg-brand-green/20',
        }
      : item.status === 'PENDENTE_REVISAO'
        ? {
            label: 'Revisao pendente',
            className: 'bg-brand-warning/10 text-brand-warning hover:bg-brand-warning/20',
          }
        : {
            label: 'Erro',
            className: 'bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20',
          };

  return (
    <Card className="transition-colors hover:bg-muted/40">
      <CardContent className="flex items-start gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          {item.status === 'PENDENTE_REVISAO' ? (
            <AlertTriangle className="h-4 w-4 text-brand-warning" aria-hidden />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-1">
            <p className="truncate text-sm font-medium">{item.fornecedorNome}</p>
            <Badge variant="secondary" className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
            <span>{item.itens.length} itens</span>
            <span className="font-mono tabular-nums">{formatBRL(Number(item.valorTotal))}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/importar/revisar/${item.id}`}>Ver</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
