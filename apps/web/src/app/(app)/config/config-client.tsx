'use client';

import { FormField } from '@/components/forms/form-field';
import { UFS } from '@/components/forms/uf-select';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Separator,
  cn,
} from '@nexo/ui';
import {
  Building2,
  CreditCard,
  FileText,
  Hash,
  Mail,
  ShieldCheck,
  Sliders,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type SecaoKey =
  | 'dados'
  | 'certificado'
  | 'series'
  | 'emails'
  | 'preferencias'
  | 'plano'
  | 'usuarios';

type EmpresaConfig = {
  id: string;
  tenantId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  ie: string | null;
  im: string | null;
  cnae: string | null;
  regimeTributario: string;
  endereco: Record<string, unknown> | null;
  contatos: Record<string, unknown> | null;
};

type ConfigResponse = {
  empresa: EmpresaConfig;
  emailTemplate: { assunto: string; remetente: string; ccPadrao?: string | null; corpo: string };
  preferencias: {
    formatoData: 'BR' | 'ISO';
    tema: 'claro' | 'escuro' | 'sistema';
    notificacoes: { email: boolean; push: boolean; sino: boolean };
  };
  certificados: Array<{
    id: string;
    cn: string;
    notAfter: string;
    ativo: boolean;
    fingerprint: string;
  }>;
  series: Array<{
    id: string;
    modelo: string;
    serie: number;
    proximoNumero: string;
    ambiente: string;
    ativa: boolean;
  }>;
  hardening: Array<{ id: string; label: string; status: string; pendencia?: string }>;
};

const SECOES: Array<{ key: SecaoKey; label: string; icon: typeof Building2 }> = [
  { key: 'dados', label: 'Dados', icon: Building2 },
  { key: 'certificado', label: 'Certificado', icon: ShieldCheck },
  { key: 'series', label: 'Séries', icon: Hash },
  { key: 'emails', label: 'E-mails', icon: Mail },
  { key: 'preferencias', label: 'Preferências', icon: Sliders },
  { key: 'plano', label: 'Plano', icon: CreditCard },
  { key: 'usuarios', label: 'Usuários', icon: Users },
];

function textFromRecord(
  record: Record<string, unknown> | null | undefined,
  key: string,
  fallback = '',
) {
  const value = record?.[key];
  return typeof value === 'string' ? value : fallback;
}

export function ConfigClient() {
  const [secao, setSecao] = useState<SecaoKey>('dados');
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/configuracoes', { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.message ?? 'Falha ao carregar configurações');
      setData(payload);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (section: string, payload: unknown) => {
    const res = await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, data: payload }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body?.message ?? 'Falha ao salvar');
      return;
    }
    toast.success('Configuração salva');
    await load();
  };

  const current = SECOES.find((item) => item.key === secao) ?? SECOES[0]!;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Dados fiscais, certificado, séries, e-mails, preferências e acessos.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside>
          <Card className="overflow-hidden p-0">
            {SECOES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSecao(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm font-medium last:border-0',
                    secao === item.key ? 'bg-brand-blue/10 text-brand-blue' : 'hover:bg-muted/50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </Card>
        </aside>

        <section className="min-w-0">
          {!data ? (
            <Card>
              <CardContent className="p-8 text-sm text-muted-foreground">
                Carregando {current.label.toLowerCase()}...
              </CardContent>
            </Card>
          ) : null}
          {data && secao === 'dados' ? <DadosEmpresa data={data} onSave={save} /> : null}
          {data && secao === 'certificado' ? <Certificado data={data} /> : null}
          {data && secao === 'series' ? <Series data={data} /> : null}
          {data && secao === 'emails' ? <Emails data={data} onSave={save} /> : null}
          {data && secao === 'preferencias' ? <Preferencias data={data} onSave={save} /> : null}
          {data && secao === 'plano' ? <Plano data={data} /> : null}
          {data && secao === 'usuarios' ? <UsuariosAtalho /> : null}
        </section>
      </div>
    </div>
  );
}

function DadosEmpresa({
  data,
  onSave,
}: { data: ConfigResponse; onSave: (section: string, payload: unknown) => Promise<void> }) {
  const endereco = useMemo(() => data.empresa.endereco ?? {}, [data.empresa.endereco]);
  const contatos = useMemo(() => data.empresa.contatos ?? {}, [data.empresa.contatos]);
  const [form, setForm] = useState({
    razaoSocial: data.empresa.razaoSocial,
    nomeFantasia: data.empresa.nomeFantasia ?? '',
    ie: data.empresa.ie ?? '',
    im: data.empresa.im ?? '',
    cnae: data.empresa.cnae ?? '',
    regimeTributario: data.empresa.regimeTributario,
    cep: textFromRecord(endereco, 'cep'),
    logradouro: textFromRecord(endereco, 'logradouro'),
    numero: textFromRecord(endereco, 'numero'),
    bairro: textFromRecord(endereco, 'bairro'),
    cidade: textFromRecord(endereco, 'cidade'),
    uf: textFromRecord(endereco, 'uf', 'SC'),
    email: textFromRecord(contatos, 'email'),
    telefone: textFromRecord(contatos, 'telefone'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Razão social" required>
            <Input
              value={form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
            />
          </FormField>
          <FormField label="Nome fantasia">
            <Input
              value={form.nomeFantasia}
              onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
            />
          </FormField>
          <FormField label="CNPJ">
            <Input value={data.empresa.cnpj} disabled />
          </FormField>
          <FormField label="Regime tributário">
            <select
              value={form.regimeTributario}
              onChange={(e) => setForm({ ...form, regimeTributario: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option>Simples Nacional</option>
              <option>Lucro Presumido</option>
              <option>Lucro Real</option>
              <option>MEI</option>
            </select>
          </FormField>
          <FormField label="Inscrição estadual">
            <Input value={form.ie} onChange={(e) => setForm({ ...form, ie: e.target.value })} />
          </FormField>
          <FormField label="Inscrição municipal">
            <Input value={form.im} onChange={(e) => setForm({ ...form, im: e.target.value })} />
          </FormField>
          <FormField label="CNAE">
            <Input value={form.cnae} onChange={(e) => setForm({ ...form, cnae: e.target.value })} />
          </FormField>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="CEP">
            <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
          </FormField>
          <FormField label="Logradouro" className="md:col-span-2">
            <Input
              value={form.logradouro}
              onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
            />
          </FormField>
          <FormField label="Número">
            <Input
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
            />
          </FormField>
          <FormField label="Bairro">
            <Input
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
            />
          </FormField>
          <FormField label="Cidade">
            <Input
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
            />
          </FormField>
          <FormField label="UF">
            <select
              value={form.uf}
              onChange={(e) => setForm({ ...form, uf: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="E-mail">
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="Telefone">
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() =>
              onSave('empresa', {
                razaoSocial: form.razaoSocial,
                nomeFantasia: form.nomeFantasia,
                ie: form.ie,
                im: form.im,
                cnae: form.cnae,
                regimeTributario: form.regimeTributario,
                endereco: {
                  cep: form.cep,
                  logradouro: form.logradouro,
                  numero: form.numero,
                  bairro: form.bairro,
                  cidade: form.cidade,
                  uf: form.uf,
                },
                contatos: { email: form.email, telefone: form.telefone },
              })
            }
          >
            Salvar dados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Certificado({ data }: { data: ConfigResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certificado digital A1</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.certificados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum certificado cadastrado.</p>
        ) : null}
        {data.certificados.map((cert) => (
          <div key={cert.id} className="flex items-start justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">{cert.cn}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {cert.fingerprint.slice(0, 24)}...
              </div>
              <div className="text-xs text-muted-foreground">
                Vence em {new Date(cert.notAfter).toLocaleDateString('pt-BR')}
              </div>
            </div>
            <Badge variant={cert.ativo ? 'success' : 'secondary'}>
              {cert.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        ))}
        <Button asChild variant="outline">
          <Link href="/configuracoes/certificado">Gerenciar certificados</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Series({ data }: { data: ConfigResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Séries fiscais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma série cadastrada.</p>
        ) : null}
        {data.series.map((serie) => (
          <div
            key={serie.id}
            className="flex items-center justify-between rounded-md border p-3 text-sm"
          >
            <div>
              <div className="font-medium">
                {serie.modelo} · Série {serie.serie}
              </div>
              <div className="text-muted-foreground">Próximo número: {serie.proximoNumero}</div>
            </div>
            <Badge variant={serie.ambiente === 'PRODUCAO' ? 'success' : 'warning'}>
              {serie.ambiente}
            </Badge>
          </div>
        ))}
        <Button asChild variant="outline">
          <Link href="/configuracoes/series">Gerenciar séries</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Emails({
  data,
  onSave,
}: { data: ConfigResponse; onSave: (section: string, payload: unknown) => Promise<void> }) {
  const [form, setForm] = useState(data.emailTemplate);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates de e-mail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Assunto">
          <Input
            value={form.assunto}
            onChange={(e) => setForm({ ...form, assunto: e.target.value })}
          />
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Remetente">
            <Input
              value={form.remetente}
              onChange={(e) => setForm({ ...form, remetente: e.target.value })}
            />
          </FormField>
          <FormField label="CC padrão">
            <Input
              value={form.ccPadrao ?? ''}
              onChange={(e) => setForm({ ...form, ccPadrao: e.target.value })}
            />
          </FormField>
        </div>
        <FormField label="Corpo">
          <textarea
            value={form.corpo}
            onChange={(e) => setForm({ ...form, corpo: e.target.value })}
            rows={9}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </FormField>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Envio real depende do provedor transacional registrado nas pendências da fase.
          </p>
          <Button onClick={() => onSave('email', form)}>Salvar template</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Preferencias({
  data,
  onSave,
}: { data: ConfigResponse; onSave: (section: string, payload: unknown) => Promise<void> }) {
  const [form, setForm] = useState(data.preferencias);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências e hardening</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Formato de data">
            <select
              value={form.formatoData}
              onChange={(e) => setForm({ ...form, formatoData: e.target.value as 'BR' | 'ISO' })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="BR">DD/MM/AAAA</option>
              <option value="ISO">AAAA-MM-DD</option>
            </select>
          </FormField>
          <FormField label="Tema">
            <select
              value={form.tema}
              onChange={(e) =>
                setForm({ ...form, tema: e.target.value as 'claro' | 'escuro' | 'sistema' })
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
              <option value="sistema">Sistema</option>
            </select>
          </FormField>
        </div>
        <div className="flex flex-wrap gap-4">
          {(['email', 'push', 'sino'] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.notificacoes[key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notificacoes: { ...form.notificacoes, [key]: e.target.checked },
                  })
                }
                className="h-4 w-4 accent-brand-blue"
              />
              {key}
            </label>
          ))}
        </div>
        <Separator />
        <div className="grid gap-2">
          {data.hardening.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <span>{item.label}</span>
              <Badge variant={item.status === 'entregue' ? 'success' : 'warning'}>
                {item.status}
                {item.pendencia ? ` · ${item.pendencia}` : ''}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => onSave('preferencias', form)}>Salvar preferências</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Plano({ data }: { data: ConfigResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano e assinatura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-brand-blue/30 bg-brand-blue/5 p-4">
          <div className="text-xs font-semibold uppercase text-brand-blue">Plano atual</div>
          <div className="mt-1 text-2xl font-bold">MVP Piloto</div>
          <p className="text-sm text-muted-foreground">
            {data.empresa.razaoSocial} opera em modo piloto até a precificação final.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Cobrança recorrente, faturas e upgrade comercial ficam prontos para conectar a um gateway
          quando o produto sair do piloto.
        </p>
      </CardContent>
    </Card>
  );
}

function UsuariosAtalho() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários e permissões</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          Crie usuários, ajuste perfis e bloqueie acessos pela tela dedicada.
        </p>
        <Button asChild>
          <Link href="/usuarios">Abrir usuários</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
