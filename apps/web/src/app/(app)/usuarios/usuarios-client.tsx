'use client';

import { DataTable, type DataTableColumn } from '@/components/cadastros/data-table';
import { FormField } from '@/components/forms/form-field';
import {
  type Usuario,
  contabilidades,
  empresas,
  usuarios as fixtureUsuarios,
} from '@/lib/mock-data';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Separator,
  cn,
} from '@nexo/ui';
import {
  Ban,
  CheckCircle2,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type PerfilChave = 'admin' | 'contador-master' | 'operador-empresa' | 'visualizador';

interface UsuarioRow extends Usuario {
  perfilChave: PerfilChave;
}

interface PerfilInfo {
  chave: PerfilChave;
  nome: string;
  descricao: string;
  sistema: boolean;
}

const PERFIS_BASE: PerfilInfo[] = [
  {
    chave: 'admin',
    nome: 'Administrador',
    descricao: 'Acesso total à plataforma — gerencia contabilidades e planos.',
    sistema: true,
  },
  {
    chave: 'contador-master',
    nome: 'Contador Master',
    descricao: 'Gestão da carteira de clientes e emissão em nome das empresas.',
    sistema: true,
  },
  {
    chave: 'operador-empresa',
    nome: 'Operador Empresa',
    descricao: 'Emissão e cadastros dentro da empresa a que está vinculado.',
    sistema: true,
  },
  {
    chave: 'visualizador',
    nome: 'Visualizador',
    descricao: 'Apenas leitura — consulta documentos e relatórios.',
    sistema: true,
  },
];

const MODULOS = [
  'Dashboard',
  'Empresas',
  'Clientes',
  'Fornecedores',
  'Produtos',
  'Serviços',
  'Emissão',
  'Documentos',
  'Estoque',
  'XML',
  'Alertas',
  'Logs',
  'Usuários',
  'Config',
] as const;

const ACOES = ['Visualizar', 'Criar', 'Editar', 'Excluir', 'Emitir'] as const;

type Permissoes = Record<string, boolean>;

function matrixKey(mod: string, acao: string) {
  return `${mod}::${acao}`;
}

function defaultPermissoes(perfil: PerfilChave): Permissoes {
  const p: Permissoes = {};
  for (const mod of MODULOS) {
    for (const acao of ACOES) {
      const k = matrixKey(mod, acao);
      if (perfil === 'admin') {
        p[k] = true;
      } else if (perfil === 'contador-master') {
        p[k] = !(mod === 'Config' && acao === 'Excluir');
      } else if (perfil === 'operador-empresa') {
        if (mod === 'Usuários' || mod === 'Logs') p[k] = acao === 'Visualizar';
        else if (mod === 'Config') p[k] = acao === 'Visualizar' || acao === 'Editar';
        else p[k] = true;
      } else {
        // visualizador
        p[k] = acao === 'Visualizar';
      }
    }
  }
  return p;
}

function mapPerfilToChave(p: Usuario['perfil'], vinculo?: string): PerfilChave {
  if (p === 'admin') return 'admin';
  if (p === 'contabilidade') return 'contador-master';
  if (p === 'empresa') {
    if (vinculo?.toLowerCase().includes('visualizador')) return 'visualizador';
    return 'operador-empresa';
  }
  return 'visualizador';
}

const EXTRAS_USUARIOS: UsuarioRow[] = [
  {
    id: 'u-7',
    nome: 'Paula Andrade',
    email: 'paula@sigmacont.com.br',
    perfil: 'contabilidade',
    perfilChave: 'contador-master',
    vinculo: 'Sigma Contabilidade',
    status: 'ativo',
    ultimoAcesso: '18/04/2026 08:02',
  },
  {
    id: 'u-8',
    nome: 'Thiago Matos',
    email: 'thiago@horizonte.com.br',
    perfil: 'contabilidade',
    perfilChave: 'contador-master',
    vinculo: 'Horizonte Contábil',
    status: 'ativo',
    ultimoAcesso: '17/04/2026 14:18',
  },
  {
    id: 'u-9',
    nome: 'Camila Torres',
    email: 'camila@oliveiratech.com.br',
    perfil: 'empresa',
    perfilChave: 'operador-empresa',
    vinculo: 'Oliveira Tech',
    status: 'ativo',
    ultimoAcesso: '18/04/2026 09:22',
  },
  {
    id: 'u-10',
    nome: 'Diego Farias',
    email: 'diego@clinicavida.com.br',
    perfil: 'empresa',
    perfilChave: 'visualizador',
    vinculo: 'Clínica Vida Integral',
    status: 'ativo',
    ultimoAcesso: '16/04/2026 22:01',
  },
  {
    id: 'u-11',
    nome: 'Renata Lima',
    email: 'renata@solarengenharia.com.br',
    perfil: 'empresa',
    perfilChave: 'operador-empresa',
    vinculo: 'Solar Engenharia',
    status: 'bloqueado',
    ultimoAcesso: '10/04/2026 16:45',
  },
  {
    id: 'u-12',
    nome: 'Felipe Nogueira',
    email: 'felipe@bompreco.com.br',
    perfil: 'empresa',
    perfilChave: 'operador-empresa',
    vinculo: 'Mercadinho Bom Preço',
    status: 'convidado',
  },
  {
    id: 'u-13',
    nome: 'Natália Rocha',
    email: 'natalia@paodourado.com.br',
    perfil: 'empresa',
    perfilChave: 'operador-empresa',
    vinculo: 'Padaria Pão Dourado',
    status: 'ativo',
    ultimoAcesso: '18/04/2026 07:20',
  },
  {
    id: 'u-14',
    nome: 'Bruno Almeida',
    email: 'bruno@alfaassessoria.com.br',
    perfil: 'contabilidade',
    perfilChave: 'contador-master',
    vinculo: 'Alfa Assessoria Contábil',
    status: 'ativo',
    ultimoAcesso: '17/04/2026 19:40',
  },
  {
    id: 'u-15',
    nome: 'Isabela Freitas',
    email: 'isabela@primegestao.com.br',
    perfil: 'contabilidade',
    perfilChave: 'contador-master',
    vinculo: 'Prime Gestão Contábil',
    status: 'convidado',
  },
];

const TODOS_USUARIOS: UsuarioRow[] = [
  ...fixtureUsuarios.map((u) => ({
    ...u,
    perfilChave: mapPerfilToChave(u.perfil, u.vinculo),
  })),
  ...EXTRAS_USUARIOS,
];

function perfilLabel(chave: PerfilChave): string {
  return PERFIS_BASE.find((p) => p.chave === chave)?.nome ?? chave;
}

function Avatar({ nome }: { nome: string }) {
  const initials = nome
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // hash simples para cor
  let sum = 0;
  for (let i = 0; i < nome.length; i++) sum += nome.charCodeAt(i);
  const palette = [
    'bg-brand-blue/15 text-brand-blue',
    'bg-brand-green/15 text-brand-green',
    'bg-brand-warning/15 text-brand-warning',
    'bg-purple-500/15 text-purple-600',
    'bg-pink-500/15 text-pink-600',
  ];
  const color = palette[sum % palette.length];
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        color,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function StatusBadge({ status }: { status: Usuario['status'] }) {
  if (status === 'ativo') {
    return (
      <Badge variant="success" className="font-medium">
        Ativo
      </Badge>
    );
  }
  if (status === 'convidado') {
    return (
      <Badge variant="warning" className="font-medium">
        Convidado
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="font-medium">
      Bloqueado
    </Badge>
  );
}

function PermissoesModal({
  open,
  onOpenChange,
  perfil,
  custom = false,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  perfil: PerfilInfo;
  custom?: boolean;
  onSave?: (perms: Permissoes) => void;
}) {
  const [perms, setPerms] = useState<Permissoes>(() => defaultPermissoes(perfil.chave));
  const disabled = perfil.sistema && !custom;

  const toggle = (mod: string, acao: string) => {
    if (disabled) return;
    const k = matrixKey(mod, acao);
    setPerms((p) => ({ ...p, [k]: !p[k] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-blue" />
            Permissões · {perfil.nome}
          </DialogTitle>
          <DialogDescription>
            {disabled
              ? 'Perfil de sistema — somente leitura.'
              : 'Marque as permissões de cada módulo e salve.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-semibold">Módulo</th>
                {ACOES.map((a) => (
                  <th key={a} className="px-2 py-2 text-center font-semibold">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULOS.map((mod) => (
                <tr key={mod} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">{mod}</td>
                  {ACOES.map((acao) => {
                    const k = matrixKey(mod, acao);
                    const checked = !!perms[k];
                    return (
                      <td key={acao} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(mod, acao)}
                          className="h-4 w-4 accent-brand-blue"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {disabled ? 'Fechar' : 'Cancelar'}
          </Button>
          {!disabled ? (
            <Button
              onClick={() => {
                onSave?.(perms);
                toast.success(`Perfil "${perfil.nome}" atualizado (mock)`);
                onOpenChange(false);
              }}
            >
              Salvar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvidarDialog({
  open,
  onOpenChange,
  onInvite,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInvite: (user: UsuarioRow) => void;
}) {
  const [email, setEmail] = useState('');
  const [perfil, setPerfil] = useState<PerfilChave>('operador-empresa');
  const [vinculo, setVinculo] = useState('');
  const [enviarEmail, setEnviarEmail] = useState(true);

  const vinculoOpcoes =
    perfil === 'contador-master'
      ? contabilidades.map((c) => c.razaoSocial)
      : empresas.map((e) => e.nomeFantasia);

  const submit = () => {
    if (!email.trim()) {
      toast.error('E-mail obrigatório');
      return;
    }
    const novo: UsuarioRow = {
      id: `u-${Date.now()}`,
      nome: email.split('@')[0] ?? 'Novo Usuário',
      email: email.trim(),
      perfil:
        perfil === 'admin' ? 'admin' : perfil === 'contador-master' ? 'contabilidade' : 'empresa',
      perfilChave: perfil,
      vinculo: vinculo || undefined,
      status: 'convidado',
    };
    onInvite(novo);
    toast.success(
      enviarEmail
        ? `Convite enviado para ${email} (mock)`
        : `Usuário criado sem convite (${email})`,
    );
    setEmail('');
    setVinculo('');
    setPerfil('operador-empresa');
    setEnviarEmail(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            O convidado recebe um e-mail com link para definir a senha (simulação).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="E-mail" htmlFor="inv-email" required>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@empresa.com.br"
            />
          </FormField>
          <FormField label="Perfil" htmlFor="inv-perfil" required>
            <select
              id="inv-perfil"
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as PerfilChave)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PERFIS_BASE.map((p) => (
                <option key={p.chave} value={p.chave}>
                  {p.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Vínculo" htmlFor="inv-vinculo">
            <select
              id="inv-vinculo"
              value={vinculo}
              onChange={(e) => setVinculo(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={perfil === 'admin'}
            >
              <option value="">
                {perfil === 'admin' ? 'Não aplicável (admin)' : 'Selecione...'}
              </option>
              {vinculoOpcoes.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enviarEmail}
              onChange={(e) => setEnviarEmail(e.target.checked)}
              className="h-4 w-4 accent-brand-blue"
            />
            Enviar convite por e-mail
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Enviar convite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarPerfilDialog({
  open,
  onOpenChange,
  usuario,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  usuario: UsuarioRow | null;
  onSave: (perfilNovo: PerfilChave) => void;
}) {
  const [perfil, setPerfil] = useState<PerfilChave>(usuario?.perfilChave ?? 'operador-empresa');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>
            {usuario ? `Alterar o perfil de ${usuario.nome}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <FormField label="Perfil" required>
          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as PerfilChave)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PERFIS_BASE.map((p) => (
              <option key={p.chave} value={p.chave}>
                {p.nome}
              </option>
            ))}
          </select>
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(perfil);
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsuariosClient() {
  const [tab, setTab] = useState<'usuarios' | 'perfis'>('usuarios');
  const [rows, setRows] = useState<UsuarioRow[]>(TODOS_USUARIOS);
  const [search, setSearch] = useState('');
  const [perfilSet, setPerfilSet] = useState<Set<PerfilChave>>(new Set());
  const [statusFiltro, setStatusFiltro] = useState<Usuario['status'] | ''>('');
  const [vinculoFiltro, setVinculoFiltro] = useState('');
  const [page, setPage] = useState(1);

  const [convidarOpen, setConvidarOpen] = useState(false);
  const [editarUsuario, setEditarUsuario] = useState<UsuarioRow | null>(null);
  const [confirmRemover, setConfirmRemover] = useState<UsuarioRow | null>(null);
  const [permsModalPerfil, setPermsModalPerfil] = useState<PerfilInfo | null>(null);
  const [permsModalCustom, setPermsModalCustom] = useState(false);
  const [novoPerfilOpen, setNovoPerfilOpen] = useState(false);
  const [perfisCustomizados, setPerfisCustomizados] = useState<PerfilInfo[]>([]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((u) => {
      if (term) {
        const match =
          u.nome.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.vinculo?.toLowerCase().includes(term) ?? false);
        if (!match) return false;
      }
      if (perfilSet.size > 0 && !perfilSet.has(u.perfilChave)) return false;
      if (statusFiltro && u.status !== statusFiltro) return false;
      if (vinculoFiltro && u.vinculo !== vinculoFiltro) return false;
      return true;
    });
  }, [rows, search, perfilSet, statusFiltro, vinculoFiltro]);

  const clearFilters = () => {
    setSearch('');
    setPerfilSet(new Set());
    setStatusFiltro('');
    setVinculoFiltro('');
    setPage(1);
  };

  const vinculos = Array.from(new Set(rows.map((r) => r.vinculo).filter(Boolean))) as string[];

  const handleBloquear = (u: UsuarioRow) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === u.id ? { ...r, status: r.status === 'bloqueado' ? 'ativo' : 'bloqueado' } : r,
      ),
    );
    toast.success(u.status === 'bloqueado' ? `${u.nome} desbloqueado` : `${u.nome} bloqueado`);
  };

  const handleReenviar = (u: UsuarioRow) => {
    toast.success(`Convite reenviado para ${u.email} (mock)`);
  };

  const handleRedefinir = (u: UsuarioRow) => {
    toast.info(`Link de redefinição enviado para ${u.email} (mock)`);
  };

  const handleRemover = (u: UsuarioRow) => {
    setRows((prev) => prev.filter((r) => r.id !== u.id));
    toast.success(`${u.nome} removido (mock)`);
  };

  const handleSalvarPerfil = (perfilNovo: PerfilChave) => {
    if (!editarUsuario) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === editarUsuario.id
          ? {
              ...r,
              perfilChave: perfilNovo,
              perfil:
                perfilNovo === 'admin'
                  ? 'admin'
                  : perfilNovo === 'contador-master'
                    ? 'contabilidade'
                    : 'empresa',
            }
          : r,
      ),
    );
    toast.success(`Perfil de ${editarUsuario.nome} atualizado (mock)`);
  };

  const columns: DataTableColumn<UsuarioRow>[] = [
    {
      key: 'nome',
      header: 'Nome',
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar nome={u.nome} />
          <div>
            <div className="font-medium">{u.nome}</div>
            <div className="text-xs text-muted-foreground">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'perfil',
      header: 'Perfil',
      render: (u) => (
        <Badge variant="secondary" className="font-medium">
          {perfilLabel(u.perfilChave)}
        </Badge>
      ),
    },
    {
      key: 'vinculo',
      header: 'Vínculo',
      render: (u) => <span className="text-sm">{u.vinculo ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'ultimoAcesso',
      header: 'Último acesso',
      className: 'text-xs text-muted-foreground',
      render: (u) => u.ultimoAcesso ?? '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários e Permissões</h1>
          <p className="text-muted-foreground">
            Controle quem acessa e o que pode fazer em cada empresa.
          </p>
        </div>
        <Button onClick={() => setConvidarOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Convidar usuário
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          {[
            { v: 'usuarios' as const, l: 'Usuários', c: rows.length },
            {
              v: 'perfis' as const,
              l: 'Perfis',
              c: PERFIS_BASE.length + perfisCustomizados.length,
            },
          ].map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
              className={cn(
                '-mb-px border-b-2 px-1 py-3 text-sm font-semibold transition-colors',
                tab === t.v
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.l}
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t.c}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {tab === 'usuarios' ? (
        <DataTable
          rows={filtered}
          columns={columns}
          getRowId={(u) => u.id}
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Buscar por nome, e-mail ou vínculo..."
          filters={
            <>
              <select
                value={statusFiltro}
                onChange={(e) => {
                  setStatusFiltro(e.target.value as Usuario['status'] | '');
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Status"
              >
                <option value="">Todos os status</option>
                <option value="ativo">Ativo</option>
                <option value="convidado">Convidado</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
              <select
                value={vinculoFiltro}
                onChange={(e) => {
                  setVinculoFiltro(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Vínculo"
              >
                <option value="">Todos os vínculos</option>
                {vinculos.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={perfilSet.size === 1 ? Array.from(perfilSet)[0] : ''}
                onChange={(e) => {
                  const v = e.target.value as PerfilChave | '';
                  setPerfilSet(v ? new Set([v]) : new Set());
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Perfil"
              >
                <option value="">Todos os perfis</option>
                {PERFIS_BASE.map((p) => (
                  <option key={p.chave} value={p.chave}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </>
          }
          onClearFilters={clearFilters}
          actions={(row) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mais ações">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setEditarUsuario(row)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar perfil
                </DropdownMenuItem>
                {row.status === 'convidado' ? (
                  <DropdownMenuItem onSelect={() => handleReenviar(row)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reenviar convite
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => handleBloquear(row)}>
                  {row.status === 'bloqueado' ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Desbloquear
                    </>
                  ) : (
                    <>
                      <Ban className="mr-2 h-4 w-4" />
                      Bloquear
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleRedefinir(row)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Redefinir senha
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-brand-danger focus:text-brand-danger"
                  onSelect={() => setConfirmRemover(row)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          page={page}
          pageSize={10}
          onPageChange={setPage}
          totalLabelSingular="usuário"
          totalLabelPlural="usuários"
          emptyTitle="Nenhum usuário encontrado"
          emptyDescription="Ajuste os filtros ou convide alguém."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Button variant="outline" onClick={() => setNovoPerfilOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar perfil customizado
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[...PERFIS_BASE, ...perfisCustomizados].map((p) => (
              <Card key={p.chave} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <UsersIcon className="h-5 w-5 text-brand-blue" />
                        {p.nome}
                      </CardTitle>
                      <CardDescription className="mt-1">{p.descricao}</CardDescription>
                    </div>
                    <Badge variant={p.sistema ? 'secondary' : 'success'}>
                      {p.sistema ? 'Sistema' : 'Customizado'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setPermsModalPerfil(p);
                      setPermsModalCustom(!p.sistema);
                    }}
                  >
                    Ver permissões
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ConvidarDialog
        open={convidarOpen}
        onOpenChange={setConvidarOpen}
        onInvite={(u) => setRows((prev) => [u, ...prev])}
      />

      <EditarPerfilDialog
        open={!!editarUsuario}
        onOpenChange={(o) => !o && setEditarUsuario(null)}
        usuario={editarUsuario}
        onSave={handleSalvarPerfil}
      />

      <Dialog open={!!confirmRemover} onOpenChange={(o) => !o && setConfirmRemover(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover usuário</DialogTitle>
            <DialogDescription>
              {confirmRemover
                ? `Remover "${confirmRemover.nome}" da plataforma? Esta ação é simulada.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemover(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmRemover) handleRemover(confirmRemover);
                setConfirmRemover(null);
              }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {permsModalPerfil ? (
        <PermissoesModal
          open={!!permsModalPerfil}
          onOpenChange={(o) => {
            if (!o) {
              setPermsModalPerfil(null);
              setPermsModalCustom(false);
            }
          }}
          perfil={permsModalPerfil}
          custom={permsModalCustom}
        />
      ) : null}

      <NovoPerfilDialog
        open={novoPerfilOpen}
        onOpenChange={setNovoPerfilOpen}
        onCreate={(p) => setPerfisCustomizados((prev) => [...prev, p])}
      />
    </div>
  );
}

function NovoPerfilDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (p: PerfilInfo) => void;
}) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [showPerms, setShowPerms] = useState(false);
  const [draftPerfil, setDraftPerfil] = useState<PerfilInfo | null>(null);

  const submit = () => {
    if (!nome.trim()) {
      toast.error('Nome do perfil é obrigatório');
      return;
    }
    const p: PerfilInfo = {
      chave: `custom-${Date.now()}` as PerfilChave,
      nome: nome.trim(),
      descricao: descricao.trim() || 'Perfil customizado',
      sistema: false,
    };
    setDraftPerfil(p);
    setShowPerms(true);
  };

  return (
    <>
      <Dialog open={open && !showPerms} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar perfil customizado</DialogTitle>
            <DialogDescription>
              Defina um nome, uma descrição e depois configure as permissões.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Nome" required>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Supervisor fiscal"
              />
            </FormField>
            <FormField label="Descrição">
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Breve descrição do que esse perfil pode fazer"
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={submit}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {draftPerfil && showPerms ? (
        <PermissoesModal
          open={showPerms}
          onOpenChange={(o) => {
            if (!o) {
              setShowPerms(false);
              onOpenChange(false);
              if (draftPerfil) {
                onCreate(draftPerfil);
                toast.success(`Perfil "${draftPerfil.nome}" criado (mock)`);
              }
              setNome('');
              setDescricao('');
              setDraftPerfil(null);
            }
          }}
          perfil={draftPerfil}
          custom
        />
      ) : null}
    </>
  );
}

// Export default do client principal mantém compat com page.tsx.
export default UsuariosClient;
