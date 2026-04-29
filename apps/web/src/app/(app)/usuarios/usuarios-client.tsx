'use client';

import { FormField } from '@/components/forms/form-field';
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
  Input,
} from '@nexo/ui';
import { Ban, KeyRound, Mail, Pencil, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  role: string;
  scopeType: string | null;
  scopeId: string | null;
  status: 'ativo' | 'convidado' | 'bloqueado';
  ultimoAcesso: string | null;
  criadoEm: string;
};

const PERFIS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'contabilidade_owner', label: 'Contador Master' },
  { value: 'empresa_owner', label: 'Responsável Empresa' },
  { value: 'empresa_operador', label: 'Operador Empresa' },
  { value: 'empresa_leitura', label: 'Visualizador' },
];

function roleLabel(role: string): string {
  return PERFIS.find((item) => item.value === role)?.label ?? role.replace('bloqueado:', '');
}

function statusVariant(status: Usuario['status']): 'success' | 'warning' | 'destructive' {
  if (status === 'ativo') return 'success';
  if (status === 'convidado') return 'warning';
  return 'destructive';
}

export function UsuariosClient() {
  const [rows, setRows] = useState<Usuario[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (status) qs.set('status', status);
      const res = await fetch(`/api/usuarios?${qs.toString()}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar usuários');
      setRows(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(
    () => ({
      ativos: rows.filter((row) => row.status === 'ativo').length,
      convidados: rows.filter((row) => row.status === 'convidado').length,
      bloqueados: rows.filter((row) => row.status === 'bloqueado').length,
    }),
    [rows],
  );

  const action = async (user: Usuario, acao: string) => {
    const res = await fetch(`/api/usuarios/${user.id}/acao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.message ?? 'Falha ao executar ação');
      return;
    }
    if (payload.pendencia) {
      toast.info(payload.message ?? `Ação registrada em ${payload.pendencia}`);
    } else {
      toast.success('Ação executada');
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários e Permissões</h1>
          <p className="text-muted-foreground">
            {metrics.ativos} ativos · {metrics.convidados} convidados · {metrics.bloqueados}{' '}
            bloqueados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Atualizar
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Convidar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por e-mail..."
            className="md:max-w-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="convidado">Convidado</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Escopo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{user.nome}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{roleLabel(user.role)}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.scopeType ?? '-'}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.ultimoAcesso ? new Date(user.ultimoAcesso).toLocaleString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(user)}
                      aria-label="Editar perfil"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        action(user, user.status === 'bloqueado' ? 'desbloquear' : 'bloquear')
                      }
                      aria-label={user.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                    >
                      {user.status === 'bloqueado' ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <Ban className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        action(
                          user,
                          user.status === 'convidado' ? 'reenviar_convite' : 'redefinir_senha',
                        )
                      }
                      aria-label={
                        user.status === 'convidado' ? 'Reenviar convite' : 'Redefinir senha'
                      }
                    >
                      {user.status === 'convidado' ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onDone={load} />
      <EditDialog usuario={editing} onOpenChange={setEditing} onDone={load} />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('empresa_operador');

  const submit = async () => {
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        email,
        role,
        scopeType: role === 'admin' ? 'platform' : 'empresa',
        enviarConvite: true,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.message ?? 'Falha ao criar usuário');
      return;
    }
    toast.success(
      payload.pendencia
        ? 'Usuário criado; envio de convite ficou em pendências.'
        : 'Usuário criado',
    );
    setNome('');
    setEmail('');
    setRole('empresa_operador');
    onOpenChange(false);
    await onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>Cria o usuário e atribui o perfil inicial.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="Nome" required>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </FormField>
          <FormField label="E-mail" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Perfil" required>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PERFIS.map((perfil) => (
                <option key={perfil.value} value={perfil.value}>
                  {perfil.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Criar usuário</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  usuario,
  onOpenChange,
  onDone,
}: {
  usuario: Usuario | null;
  onOpenChange: (usuario: Usuario | null) => void;
  onDone: () => Promise<void>;
}) {
  const [role, setRole] = useState(usuario?.role.replace('bloqueado:', '') ?? 'empresa_operador');

  useEffect(() => {
    if (usuario) setRole(usuario.role.replace('bloqueado:', ''));
  }, [usuario]);

  const submit = async () => {
    if (!usuario) return;
    const res = await fetch(`/api/usuarios/${usuario.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, scopeType: role === 'admin' ? 'platform' : 'empresa' }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload?.message ?? 'Falha ao atualizar usuário');
      return;
    }
    toast.success('Perfil atualizado');
    onOpenChange(null);
    await onDone();
  };

  return (
    <Dialog open={!!usuario} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>{usuario ? usuario.email : ''}</DialogDescription>
        </DialogHeader>
        <FormField label="Perfil" required>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PERFIS.map((perfil) => (
              <option key={perfil.value} value={perfil.value}>
                {perfil.label}
              </option>
            ))}
          </select>
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(null)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UsuariosClient;
