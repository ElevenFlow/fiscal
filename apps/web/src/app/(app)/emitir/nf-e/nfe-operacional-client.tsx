'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, StatusPill } from '@nexo/ui';
import { Ban, Download, FileText, Loader2, RefreshCw, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type SerieFiscal = {
  id: string;
  empresaId: string;
  modelo: string;
  serie: number;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  ativa: boolean;
};

type Empresa = { id: string; razaoSocial?: string; nomeFantasia?: string };

type NotaFiscalApi = {
  id: string;
  empresaId: string;
  serieFiscalId?: string | null;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  serie: number;
  numero?: string | null;
  chaveAcesso?: string | null;
  status: string;
  protocoloAutorizacao?: string | null;
  rejeicaoCodigo?: string | null;
  rejeicaoMensagem?: string | null;
  xmlDisponivel?: boolean;
  danfeDisponivel?: boolean;
  createdAt: string;
  eventos?: Array<{
    id: string;
    action: string;
    status: string;
    codigo?: string | null;
    mensagem?: string | null;
    createdAt: string;
  }>;
};

const statusMap: Record<string, 'autorizada' | 'rejeitada' | 'cancelada' | 'pendente' | 'processando' | 'rascunho'> = {
  AUTHORIZED: 'autorizada',
  CANCELLED: 'cancelada',
  REJECTED: 'rejeitada',
  PENDING_RESPONSE: 'pendente',
  TRANSMITTING: 'processando',
  SIGNING: 'processando',
  DRAFT: 'rascunho',
};

export function NfeOperacionalClient() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [series, setSeries] = useState<SerieFiscal[]>([]);
  const [notas, setNotas] = useState<NotaFiscalApi[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [serieFiscalId, setSerieFiscalId] = useState('');
  const [loading, setLoading] = useState(false);

  const serieSelecionada = useMemo(
    () => series.find((serie) => serie.id === serieFiscalId),
    [series, serieFiscalId],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [empresasRes, seriesRes, notasRes] = await Promise.all([
        fetch('/api/empresas/minhas'),
        fetch('/api/series'),
        fetch('/api/fiscal/nfe'),
      ]);
      const empresasData = empresasRes.ok ? await empresasRes.json() : [];
      const seriesData = seriesRes.ok ? await seriesRes.json() : [];
      const notasData = notasRes.ok ? await notasRes.json() : [];
      const nfeSeries = (Array.isArray(seriesData) ? seriesData : []).filter(
        (serie: SerieFiscal) => serie.modelo === 'NFE_55' && serie.ativa,
      );
      setEmpresas(Array.isArray(empresasData) ? empresasData : []);
      setSeries(nfeSeries);
      setNotas(Array.isArray(notasData) ? notasData : []);
      setEmpresaId((current) => current || empresasData?.[0]?.id || '');
      setSerieFiscalId((current) => current || nfeSeries?.[0]?.id || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const criarRascunho = async () => {
    if (!empresaId || !serieSelecionada) {
      toast.error('Configure empresa e série NF-e antes de criar o rascunho.');
      return;
    }
    setLoading(true);
    try {
      const accessKey = '42160412345678000195550010000000011000000019';
      const res = await fetch('/api/fiscal/nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          serieFiscalId: serieSelecionada.id,
          ambiente: serieSelecionada.ambiente,
          serie: serieSelecionada.serie,
          idempotencyKey: `nfe-${Date.now()}`,
          payload: {
            nfeXml: {
              infNFeId: `NFe${accessKey}`,
              infNFe: {
                ide: {
                  cUF: '42',
                  cNF: '00000001',
                  natOp: 'VENDA',
                  mod: '55',
                  serie: String(serieSelecionada.serie),
                  nNF: '1',
                },
                emit: { CNPJ: '12345678000195', xNome: 'NEXO FISCAL HOMOLOGACAO' },
              },
            },
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Rascunho NF-e criado.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar rascunho.');
    } finally {
      setLoading(false);
    }
  };

  const emitir = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fiscal/nfe/${id}/emitir`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Emissão enviada para processamento.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao emitir NF-e.');
    } finally {
      setLoading(false);
    }
  };

  const cancelar = async (id: string) => {
    const justificativa = window.prompt('Justificativa do cancelamento (mínimo 15 caracteres)');
    if (!justificativa) return;
    if (justificativa.trim().length < 15) {
      toast.error('A justificativa precisa ter pelo menos 15 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/fiscal/nfe/${id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Cancelamento processado.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao cancelar NF-e.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card className="rounded-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Operação SEFAZ-SC</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Emissão direta NF-e 55 via SVRS, com rascunho, fila e acompanhamento.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </Button>
              <Button size="sm" onClick={criarRascunho} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Rascunho real
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Empresa</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={empresaId}
                onChange={(event) => setEmpresaId(event.target.value)}
              >
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nomeFantasia || empresa.razaoSocial || empresa.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Série NF-e</span>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={serieFiscalId}
                onChange={(event) => setSerieFiscalId(event.target.value)}
              >
                {series.map((serie) => (
                  <option key={serie.id} value={serie.id}>
                    Série {serie.serie} - {serie.ambiente}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Criada em</th>
                  <th className="px-3 py-2 font-medium">Série/Número</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Último evento</th>
                  <th className="px-3 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {notas.slice(0, 8).map((nota) => (
                  <tr key={nota.id} className="border-t">
                    <td className="px-3 py-2">{new Date(nota.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2">
                      {nota.serie}/{nota.numero ?? '-'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={statusMap[nota.status] ?? 'rascunho'} label={nota.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[260px] truncate">
                        {nota.eventos?.[0]?.mensagem ??
                          nota.protocoloAutorizacao ??
                          nota.rejeicaoMensagem ??
                          '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => emitir(nota.id)}>
                          <Send className="h-4 w-4" />
                          Emitir
                        </Button>
                        <Button size="icon" variant="ghost" asChild disabled={!nota.xmlDisponivel}>
                          <a href={`/api/fiscal/nfe/${nota.id}/xml`} aria-label="Baixar XML">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button size="icon" variant="ghost" asChild disabled={!nota.danfeDisponivel}>
                          <a href={`/api/fiscal/nfe/${nota.id}/danfe`} aria-label="Baixar DANFE">
                            <FileText className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={nota.status !== 'AUTHORIZED'}
                          onClick={() => cancelar(nota.id)}
                          aria-label="Cancelar NF-e"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {notas.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                      Nenhuma NF-e real criada ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
