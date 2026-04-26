'use client';

/**
 * Tela /configuracoes/series — Plan 02-07 Task 4.
 *
 * Lista de séries fiscais (NF-e 55, NFS-e) por empresa do tenant + form de
 * criação + toggle de ambiente (HOMOLOGACAO ↔ PRODUCAO).
 *
 * NOTA: empresaId atual virá do EmpresaSwitcher (Phase 7); por enquanto pega
 * a primeira empresa do hook /api/empresas/minhas.
 */

import { Badge, Button, Input } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

interface Serie {
  id: string;
  empresaId: string;
  modelo: 'NFE_55' | 'NFSE';
  serie: number;
  proximoNumero: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  ativa: boolean;
}

interface EmpresaMinha {
  id: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  ambiente?: string;
}

export default function SeriesPage() {
  const qc = useQueryClient();

  const { data: empresasResp } = useQuery<{ empresas: EmpresaMinha[] }>({
    queryKey: ['empresas-minhas'],
    queryFn: async () => {
      const res = await fetch('/api/empresas/minhas');
      if (!res.ok) throw new Error('Falha ao carregar empresas');
      return res.json();
    },
  });
  const empresaAtivaId = empresasResp?.empresas?.[0]?.id;

  const { data: series = [], isLoading } = useQuery<Serie[]>({
    queryKey: ['series'],
    queryFn: async () => {
      const res = await fetch('/api/series');
      if (!res.ok) throw new Error('Falha ao carregar séries');
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items ?? []);
    },
  });

  const toggleAmbiente = useMutation({
    mutationFn: async (s: Serie) => {
      const next = s.ambiente === 'HOMOLOGACAO' ? 'PRODUCAO' : 'HOMOLOGACAO';
      const res = await fetch(`/api/series/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambiente: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Falha ao alternar ambiente');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['series'] });
      toast.success('Ambiente atualizado.');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const [modelo, setModelo] = useState<'NFE_55' | 'NFSE'>('NFE_55');
  const [serieNum, setSerieNum] = useState(1);
  const [ambiente, setAmbiente] = useState<'HOMOLOGACAO' | 'PRODUCAO'>('HOMOLOGACAO');
  const [proximo, setProximo] = useState(1);

  const create = useMutation({
    mutationFn: async () => {
      if (!empresaAtivaId) {
        throw new Error('Selecione uma empresa ativa para criar séries.');
      }
      const res = await fetch('/api/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId: empresaAtivaId,
          modelo,
          serie: serieNum,
          proximoNumero: proximo,
          ambiente,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Falha ao criar série');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['series'] });
      toast.success('Série criada.');
      setSerieNum(1);
      setProximo(1);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Séries Fiscais</h1>
        <p className="text-muted-foreground">
          Numeração de NF-e 55 e NFS-e por empresa e ambiente. Banner amarelo aparece
          no shell quando alguma série está em HOMOLOGAÇÃO.
        </p>
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3 rounded-lg border bg-card p-6"
      >
        <h2 className="text-lg font-semibold">Nova série</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="block text-xs font-medium" htmlFor="modelo">
              Modelo
            </label>
            <select
              id="modelo"
              value={modelo}
              onChange={(e) => setModelo(e.target.value as 'NFE_55' | 'NFSE')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="NFE_55">NF-e 55</option>
              <option value="NFSE">NFS-e</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="serie-num">
              Série
            </label>
            <Input
              id="serie-num"
              type="number"
              min={1}
              max={999}
              value={serieNum}
              onChange={(e) => setSerieNum(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="proximo">
              Próximo número
            </label>
            <Input
              id="proximo"
              type="number"
              min={1}
              value={proximo}
              onChange={(e) => setProximo(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="amb">
              Ambiente
            </label>
            <select
              id="amb"
              value={ambiente}
              onChange={(e) =>
                setAmbiente(e.target.value as 'HOMOLOGACAO' | 'PRODUCAO')
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="HOMOLOGACAO">Homologação</option>
              <option value="PRODUCAO">Produção</option>
            </select>
          </div>
        </div>
        <Button type="submit" disabled={create.isPending || !empresaAtivaId}>
          {create.isPending ? 'Criando...' : 'Criar série'}
        </Button>
        {!empresaAtivaId ? (
          <p className="text-xs text-muted-foreground">
            Aguardando carregamento da empresa ativa…
          </p>
        ) : null}
      </form>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Séries cadastradas</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
        {!isLoading && series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma série cadastrada ainda.</p>
        ) : null}
        {series.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border bg-card p-4"
          >
            <div>
              <div className="font-medium">
                {s.modelo === 'NFE_55' ? 'NF-e 55' : 'NFS-e'} • Série {s.serie}
              </div>
              <div className="text-xs text-muted-foreground">
                Próximo número: {s.proximoNumero}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                className={
                  s.ambiente === 'HOMOLOGACAO'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-emerald-600 text-white'
                }
              >
                {s.ambiente}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleAmbiente.mutate(s)}
                disabled={toggleAmbiente.isPending}
              >
                Alternar ambiente
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
