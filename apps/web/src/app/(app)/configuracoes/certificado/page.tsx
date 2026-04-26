'use client';

/**
 * Tela /configuracoes/certificado — Plan 02-07 Task 4.
 *
 * Upload .pfx multipart + senha (Plan 02-04 KMS envelope) + lista de certs
 * com badge de status (Válido / Vencendo / Vencido / Inativo).
 */

import { Badge, Button, Input } from '@nexo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

interface Cert {
  id: string;
  cn: string;
  cnpjCertificado: string;
  fingerprint: string;
  notBefore: string;
  notAfter: string;
  ativo: boolean;
}

function statusBadge(cert: Cert) {
  if (!cert.ativo) return <Badge variant="secondary">Inativo</Badge>;
  const days = Math.floor(
    (new Date(cert.notAfter).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (days <= 30)
    return (
      <Badge className="bg-yellow-500 text-white">
        Vence em {days}d
      </Badge>
    );
  return <Badge className="bg-emerald-600 text-white">Válido</Badge>;
}

export default function CertificadoPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');

  const { data: certs = [], isLoading } = useQuery<Cert[]>({
    queryKey: ['certificados'],
    queryFn: async () => {
      const res = await fetch('/api/certificados');
      if (!res.ok) throw new Error('Falha ao carregar certificados');
      const data = await res.json();
      // apps/api retorna { items: [...] } ou array direto — normaliza
      return Array.isArray(data) ? data : (data.items ?? []);
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um arquivo .pfx');
      if (!password) throw new Error('Senha do certificado é obrigatória');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('password', password);
      const res = await fetch('/api/certificados', { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Falha no upload do certificado');
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certificados'] });
      setFile(null);
      setPassword('');
      toast.success('Certificado A1 cadastrado com sucesso.');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Certificado Digital A1</h1>
        <p className="text-muted-foreground">
          Suba o arquivo <code className="font-mono">.pfx</code> para emitir notas. O
          arquivo é cifrado em repouso (KMS envelope encryption + S3 Object Lock
          Governance).
        </p>
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          upload.mutate();
        }}
        className="space-y-3 rounded-lg border bg-card p-6"
      >
        <h2 className="text-lg font-semibold">Novo certificado</h2>
        <label className="block text-sm font-medium" htmlFor="cert-file">
          Arquivo .pfx (max 100 KB)
        </label>
        <input
          id="cert-file"
          type="file"
          accept=".pfx,.p12"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted-foreground"
        />
        <label className="block text-sm font-medium" htmlFor="cert-password">
          Senha do certificado
        </label>
        <Input
          id="cert-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="•••••••••"
          autoComplete="off"
        />
        <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          A senha NÃO é armazenada — usada apenas para parsear o .pfx no servidor;
          o resultado é cifrado com chave KMS específica do tenant. Pino redact
          garante que o buffer não vaza nos logs.
        </p>
        <Button type="submit" disabled={upload.isPending}>
          {upload.isPending ? 'Enviando...' : 'Enviar certificado'}
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Certificados cadastrados</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
        {!isLoading && certs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum certificado cadastrado ainda.
          </p>
        ) : null}
        {certs.map((c) => (
          <div
            key={c.id}
            className="flex items-start justify-between rounded-lg border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden />
              </div>
              <div>
                <div className="font-medium">{c.cn}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  CNPJ: {c.cnpjCertificado}
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  Fingerprint: {c.fingerprint.slice(0, 16)}...
                </div>
                <div className="text-xs text-muted-foreground">
                  Válido de {new Date(c.notBefore).toLocaleDateString('pt-BR')} até{' '}
                  {new Date(c.notAfter).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
            <div>{statusBadge(c)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
