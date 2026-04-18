'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@nexo/ui';
import { AlertTriangle } from 'lucide-react';
import { type FormEvent, useState } from 'react';

/**
 * DeleteDataForm — chama route handler same-origin (BLOCKER #2 Option A).
 *
 * Client components NUNCA chamam apps/api direto. Flow:
 *   client → /api/lgpd/delete (Next.js Route Handler) → fetchApi server-side
 *   → apps/api POST /api/lgpd/deletion-request
 *
 * UI comunica explicitamente que dados fiscais NÃO serão apagados (CTN/retenção legal) —
 * apenas dados não-fiscais serão anonimizados pelo DPO em até 15 dias úteis.
 */
export function DeleteDataForm() {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<{ protocoloId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 10) {
      setError('Informe ao menos 10 caracteres de motivo.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/lgpd/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { status: string; protocoloId: string };
      setSubmitted({ protocoloId: data.protocoloId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-brand-danger/30">
        <CardContent className="space-y-2 p-6 text-sm">
          <p className="font-medium">Pedido registrado.</p>
          <p>
            Protocolo: <code className="font-mono">{submitted.protocoloId}</code>
          </p>
          <p>
            O DPO responderá em até 15 dias úteis via e-mail. Dados fiscais permanecerão preservados
            por obrigação legal (CTN Arts. 173/174).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-brand-danger/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-brand-danger">
          <AlertTriangle className="h-4 w-4" />
          Solicitar exclusão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          XMLs fiscais e registros de auditoria NÃO podem ser excluídos antes do prazo legal (CTN).
          Dados não-fiscais (preferências, perfil opcional) serão anonimizados.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Motivo (mín. 10 caracteres)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
          {error && <p className="text-brand-danger">{error}</p>}
          <Button type="submit" variant="destructive" disabled={loading}>
            {loading ? 'Enviando...' : 'Solicitar exclusão'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
