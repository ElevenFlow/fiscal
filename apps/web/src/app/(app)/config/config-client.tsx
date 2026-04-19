'use client';

import { FormField } from '@/components/forms/form-field';
import { MaskedInput } from '@/components/forms/masked-input';
import { UFS } from '@/components/forms/uf-select';
import { useMockUser } from '@/lib/mock-auth';
import { empresas } from '@/lib/mock-data';
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
  Input,
  Money,
  Separator,
  cn,
} from '@nexo/ui';
import {
  Building2,
  ChevronRight,
  CreditCard,
  FileCheck2,
  Hash,
  KeyRound,
  Mail,
  Plug,
  Shield,
  ShieldCheck,
  Sliders,
  Upload,
  Users as UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { toast } from 'sonner';

type SecaoKey =
  | 'dados'
  | 'certificado'
  | 'series'
  | 'integracoes'
  | 'emails'
  | 'preferencias'
  | 'plano'
  | 'usuarios';

interface Secao {
  key: SecaoKey;
  label: string;
  descricao: string;
  icon: typeof Building2;
}

const SECOES: Secao[] = [
  {
    key: 'dados',
    label: 'Dados da empresa',
    descricao: 'Razão, CNPJ, regime, endereço e contato.',
    icon: Building2,
  },
  {
    key: 'certificado',
    label: 'Certificado digital',
    descricao: 'Upload, renovação e histórico do A1.',
    icon: ShieldCheck,
  },
  {
    key: 'series',
    label: 'Séries de notas',
    descricao: 'Numeração NFS-e e NF-e por ambiente.',
    icon: Hash,
  },
  {
    key: 'integracoes',
    label: 'Integrações',
    descricao: 'Prefeitura, SEFAZ e gateways fiscais.',
    icon: Plug,
  },
  {
    key: 'emails',
    label: 'E-mails automáticos',
    descricao: 'Templates e remetente padrão.',
    icon: Mail,
  },
  {
    key: 'preferencias',
    label: 'Preferências',
    descricao: 'Moeda, fuso, idioma e notificações.',
    icon: Sliders,
  },
  {
    key: 'plano',
    label: 'Plano e assinatura',
    descricao: 'Limites, uso e histórico de faturas.',
    icon: CreditCard,
  },
  {
    key: 'usuarios',
    label: 'Usuários da empresa',
    descricao: 'Atalho para gestão de acessos.',
    icon: UsersIcon,
  },
];

interface HistoricoFatura {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  status: 'pago' | 'pendente' | 'vencido';
}

const HISTORICO: HistoricoFatura[] = [
  {
    id: 'fat-1',
    data: '18/04/2026',
    descricao: 'Mensalidade Abr/2026',
    valor: 149,
    status: 'pago',
  },
  {
    id: 'fat-2',
    data: '18/03/2026',
    descricao: 'Mensalidade Mar/2026',
    valor: 149,
    status: 'pago',
  },
  {
    id: 'fat-3',
    data: '18/02/2026',
    descricao: 'Mensalidade Fev/2026',
    valor: 149,
    status: 'pago',
  },
  {
    id: 'fat-4',
    data: '18/01/2026',
    descricao: 'Mensalidade Jan/2026',
    valor: 149,
    status: 'pago',
  },
  {
    id: 'fat-5',
    data: '18/12/2025',
    descricao: 'Mensalidade Dez/2025',
    valor: 149,
    status: 'pago',
  },
  {
    id: 'fat-6',
    data: '18/11/2025',
    descricao: 'Mensalidade Nov/2025',
    valor: 149,
    status: 'pago',
  },
];

interface Serie {
  id: string;
  modelo: 'NFS-e' | 'NF-e';
  serie: string;
  proximoNumero: string;
  ambiente: 'producao' | 'homologacao';
  ativa: boolean;
}

const SERIES_INICIAIS: Serie[] = [
  {
    id: 'ser-1',
    modelo: 'NFS-e',
    serie: '1',
    proximoNumero: '000250',
    ambiente: 'producao',
    ativa: true,
  },
  {
    id: 'ser-2',
    modelo: 'NF-e',
    serie: '1',
    proximoNumero: '001874',
    ambiente: 'producao',
    ativa: true,
  },
  {
    id: 'ser-3',
    modelo: 'NF-e',
    serie: '901',
    proximoNumero: '000005',
    ambiente: 'homologacao',
    ativa: true,
  },
];

function SectionWrapper({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function DadosEmpresa() {
  const user = useMockUser();
  const empresa = useMemo(
    () => empresas.find((e) => e.id === user.empresaAtivaId) ?? empresas[0],
    [user.empresaAtivaId],
  );
  const [razao, setRazao] = useState(empresa?.razaoSocial ?? '');
  const [fantasia, setFantasia] = useState(empresa?.nomeFantasia ?? '');
  const [ie, setIe] = useState('123.456.789.000');
  const [im, setIm] = useState('4.567.890-0');
  const [regime, setRegime] = useState(empresa?.regime ?? 'Simples Nacional');
  const [cnae, setCnae] = useState('6201-5/01');
  const [cep, setCep] = useState('01310-200');
  const [logradouro, setLogradouro] = useState('Av. Paulista');
  const [numero, setNumero] = useState('1578');
  const [complemento, setComplemento] = useState('Sala 12');
  const [bairro, setBairro] = useState('Bela Vista');
  const [cidade, setCidade] = useState(empresa?.cidade ?? 'São Paulo');
  const [uf, setUf] = useState(empresa?.uf ?? 'SP');
  const [emailContato, setEmailContato] = useState('contato@oliveiratech.com.br');
  const [telefone, setTelefone] = useState('(11) 3456-7890');

  return (
    <SectionWrapper
      title="Dados da empresa"
      description="Esses dados aparecem em todas as notas emitidas."
    >
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Razão social" required>
              <Input value={razao} onChange={(e) => setRazao(e.target.value)} />
            </FormField>
            <FormField label="Nome fantasia">
              <Input value={fantasia} onChange={(e) => setFantasia(e.target.value)} />
            </FormField>
            <FormField label="CNPJ" hint="Não editável — criado na contratação">
              <MaskedInput mask="cnpj" value={empresa?.cnpj ?? ''} disabled />
            </FormField>
            <FormField label="Inscrição Estadual">
              <Input value={ie} onChange={(e) => setIe(e.target.value)} />
            </FormField>
            <FormField label="Inscrição Municipal">
              <Input value={im} onChange={(e) => setIm(e.target.value)} />
            </FormField>
            <FormField label="Regime tributário" required>
              <select
                value={regime}
                onChange={(e) => setRegime(e.target.value as typeof regime)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Simples Nacional</option>
                <option>Lucro Presumido</option>
                <option>Lucro Real</option>
                <option>MEI</option>
              </select>
            </FormField>
            <FormField label="CNAE principal">
              <Input value={cnae} onChange={(e) => setCnae(e.target.value)} />
            </FormField>
          </div>

          <Separator />

          <h3 className="text-sm font-semibold">Endereço</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="CEP" required>
              <MaskedInput
                mask="cep"
                value={cep}
                onChange={(v) => {
                  setCep(v);
                  if (v.replace(/\D/g, '').length === 8) {
                    toast.success('Endereço preenchido automaticamente (mock)');
                  }
                }}
              />
            </FormField>
            <FormField label="Logradouro" className="md:col-span-2">
              <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
            </FormField>
            <FormField label="Número">
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </FormField>
            <FormField label="Complemento">
              <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </FormField>
            <FormField label="Bairro">
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </FormField>
            <FormField label="Cidade">
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </FormField>
            <FormField label="UF">
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <Separator />

          <h3 className="text-sm font-semibold">Contato</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="E-mail">
              <Input
                type="email"
                value={emailContato}
                onChange={(e) => setEmailContato(e.target.value)}
              />
            </FormField>
            <FormField label="Telefone">
              <MaskedInput mask="phone" value={telefone} onChange={setTelefone} />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => toast.info('Alterações descartadas (mock)')}>
              Cancelar
            </Button>
            <Button onClick={() => toast.success('Dados da empresa salvos (mock)')}>
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </SectionWrapper>
  );
}

function CertificadoDigital() {
  const [renovarOpen, setRenovarOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  return (
    <SectionWrapper
      title="Certificado digital"
      description="O certificado A1 assina as notas eletronicamente. Mantenha-o sempre válido."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-warning/15">
                <ShieldCheck className="h-6 w-6 text-brand-warning" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">Vence em 28 dias</h3>
                  <Badge variant="warning">Atenção</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expira em 16/05/2026. Programe a renovação o quanto antes.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setHistoricoOpen(true)}>
                Histórico
              </Button>
              <Button onClick={() => setRenovarOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Renovar certificado
              </Button>
            </div>
          </div>

          <Separator />

          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Titular
              </dt>
              <dd className="mt-0.5">OLIVEIRA TECH SOLUCOES LTDA</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                CNPJ titular
              </dt>
              <dd className="mt-0.5 font-mono">12.345.678/0001-90</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data de upload
              </dt>
              <dd className="mt-0.5">16/05/2025 09:14</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Validade
              </dt>
              <dd className="mt-0.5">16/05/2026 09:14</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fingerprint (SHA-256)
              </dt>
              <dd className="mt-0.5 break-all font-mono text-xs">
                3f:a9:c2:17:8b:45:6d:e2:91:04:a8:77:bc:3e:1d:88:5f:7a:29:b1:4c:6e:f3:9a:28:55:72:d4:81:a3:b7:09
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Dialog open={renovarOpen} onOpenChange={setRenovarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar certificado digital</DialogTitle>
            <DialogDescription>
              Carregue o novo arquivo <strong>.pfx</strong> e informe a senha. O certificado atual
              permanece válido até o novo ser ativado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Arquivo .pfx" required>
              <Input type="file" accept=".pfx,.p12" />
            </FormField>
            <FormField label="Senha do certificado" required>
              <Input type="password" placeholder="•••••••••" />
            </FormField>
            <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              A senha é armazenada criptografada com KMS (AES-256). Não é registrada em logs.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenovarOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                toast.success('Certificado renovado (mock)');
                setRenovarOpen(false);
              }}
            >
              Enviar e ativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de certificados</DialogTitle>
            <DialogDescription>Versões anteriores mantidas por compliance.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-3 py-2 text-sm">
            <li className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">Certificado ativo</div>
                <div className="text-xs text-muted-foreground">
                  16/05/2025 → 16/05/2026 · fingerprint 3f:a9:c2:...
                </div>
              </div>
              <Badge variant="warning">Vencendo</Badge>
            </li>
            <li className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">Certificado 2024/2025</div>
                <div className="text-xs text-muted-foreground">
                  02/06/2024 → 02/06/2025 · fingerprint 8a:4b:d7:...
                </div>
              </div>
              <Badge variant="secondary">Expirado</Badge>
            </li>
            <li className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">Certificado 2023/2024</div>
                <div className="text-xs text-muted-foreground">
                  14/03/2023 → 14/03/2024 · fingerprint 1c:9f:e0:...
                </div>
              </div>
              <Badge variant="secondary">Expirado</Badge>
            </li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  );
}

function SeriesNotas() {
  const [tab, setTab] = useState<'NFS-e' | 'NF-e'>('NFS-e');
  const [series, setSeries] = useState<Serie[]>(SERIES_INICIAIS);
  const [novaOpen, setNovaOpen] = useState(false);
  const [novaModelo, setNovaModelo] = useState<'NFS-e' | 'NF-e'>('NFS-e');
  const [novaSerie, setNovaSerie] = useState('');
  const [novoAmb, setNovoAmb] = useState<'producao' | 'homologacao'>('producao');
  const [novoNum, setNovoNum] = useState('');

  const rows = series.filter((s) => s.modelo === tab);

  const toggleAtiva = (id: string) => {
    setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, ativa: !s.ativa } : s)));
    toast.success('Status da série atualizado (mock)');
  };

  const criar = () => {
    if (!novaSerie || !novoNum) {
      toast.error('Preencha série e número inicial');
      return;
    }
    setSeries((prev) => [
      ...prev,
      {
        id: `ser-${Date.now()}`,
        modelo: novaModelo,
        serie: novaSerie,
        proximoNumero: novoNum.padStart(6, '0'),
        ambiente: novoAmb,
        ativa: true,
      },
    ]);
    toast.success('Nova série criada (mock)');
    setNovaSerie('');
    setNovoNum('');
    setNovaOpen(false);
  };

  return (
    <SectionWrapper
      title="Séries de notas"
      description="Controle a numeração por modelo e ambiente. Alteração gera entrada no audit log."
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-4 border-b">
          {(['NFS-e', 'NF-e'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                '-mb-px border-b-2 px-1 py-2 text-sm font-semibold transition-colors',
                tab === t
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => setNovaOpen(true)}>
          Nova série
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Modelo</th>
              <th className="px-4 py-3 font-semibold">Série</th>
              <th className="px-4 py-3 font-semibold">Próximo número</th>
              <th className="px-4 py-3 font-semibold">Ambiente</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma série {tab} cadastrada.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{s.modelo}</td>
                  <td className="px-4 py-3 font-mono">{s.serie}</td>
                  <td className="px-4 py-3 font-mono">{s.proximoNumero}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={s.ambiente === 'producao' ? 'success' : 'warning'}
                      className="font-medium"
                    >
                      {s.ambiente === 'producao' ? 'Produção' : 'Homologação'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.ativa ? 'default' : 'secondary'}>
                      {s.ativa ? 'Ativa' : 'Pausada'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggleAtiva(s.id)}>
                      {s.ativa ? 'Pausar' : 'Ativar'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova série</DialogTitle>
            <DialogDescription>
              Defina modelo, série, ambiente e próximo número. Manter numeração sequencial evita
              rejeição SEFAZ.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Modelo" required>
              <select
                value={novaModelo}
                onChange={(e) => setNovaModelo(e.target.value as 'NFS-e' | 'NF-e')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="NFS-e">NFS-e</option>
                <option value="NF-e">NF-e</option>
              </select>
            </FormField>
            <FormField label="Série" required>
              <Input value={novaSerie} onChange={(e) => setNovaSerie(e.target.value)} />
            </FormField>
            <FormField label="Ambiente" required>
              <select
                value={novoAmb}
                onChange={(e) => setNovoAmb(e.target.value as 'producao' | 'homologacao')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="producao">Produção</option>
                <option value="homologacao">Homologação</option>
              </select>
            </FormField>
            <FormField label="Primeiro número" required>
              <Input value={novoNum} onChange={(e) => setNovoNum(e.target.value)} placeholder="1" />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={criar}>Criar série</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  );
}

function Integracoes() {
  const [prefUrl, setPrefUrl] = useState('https://nfe.prefeitura.sp.gov.br/ws/nfs-e.wsdl');
  const [prefAuth, setPrefAuth] = useState<'cert' | 'user'>('cert');
  const [prefUser, setPrefUser] = useState('');
  const [prefPass, setPrefPass] = useState('');

  const [ufSefaz, setUfSefaz] = useState('SP');
  const [ambSefaz, setAmbSefaz] = useState<'producao' | 'homologacao'>('producao');

  const [focusAtivo, setFocusAtivo] = useState(false);
  const [focusKey, setFocusKey] = useState('');

  return (
    <SectionWrapper
      title="Integrações"
      description="Conexões com prefeitura, SEFAZ estadual e gateways fiscais."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCheck2 className="h-5 w-5 text-brand-blue" />
              Prefeitura (NFS-e)
            </CardTitle>
            <CardDescription>
              Integração para emissão de Nota Fiscal de Serviço eletrônica.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="URL do WebService">
              <Input value={prefUrl} onChange={(e) => setPrefUrl(e.target.value)} />
            </FormField>
            <div className="space-y-2">
              <span className="text-sm font-medium">Autenticação</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={prefAuth === 'cert'}
                  onChange={() => setPrefAuth('cert')}
                  className="h-4 w-4 accent-brand-blue"
                />
                Usar certificado da empresa
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={prefAuth === 'user'}
                  onChange={() => setPrefAuth('user')}
                  className="h-4 w-4 accent-brand-blue"
                />
                Usuário e senha da prefeitura
              </label>
            </div>
            {prefAuth === 'user' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Usuário">
                  <Input value={prefUser} onChange={(e) => setPrefUser(e.target.value)} />
                </FormField>
                <FormField label="Senha">
                  <Input
                    type="password"
                    value={prefPass}
                    onChange={(e) => setPrefPass(e.target.value)}
                  />
                </FormField>
              </div>
            ) : null}
            <Button variant="outline" onClick={() => toast.success('Conectado (mock)')}>
              Testar conexão
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-brand-blue" />
              SEFAZ Estadual
            </CardTitle>
            <CardDescription>
              Emissão de NF-e e devoluções pela secretaria da fazenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Estado (UF)">
              <select
                value={ufSefaz}
                onChange={(e) => setUfSefaz(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Ambiente">
              <select
                value={ambSefaz}
                onChange={(e) => setAmbSefaz(e.target.value as 'producao' | 'homologacao')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="producao">Produção</option>
                <option value="homologacao">Homologação</option>
              </select>
            </FormField>
            <Button variant="outline" onClick={() => toast.success('Status SEFAZ: OK (mock)')}>
              Testar conexão
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-5 w-5 text-muted-foreground" />
              Focus NFe (Gateway)
              <Badge variant="secondary" className="ml-2">
                Opcional
              </Badge>
            </CardTitle>
            <CardDescription>
              Alternativa à integração direta via SEFAZ. Útil para emissão em múltiplas UFs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={focusAtivo}
                onChange={(e) => setFocusAtivo(e.target.checked)}
                className="h-4 w-4 accent-brand-blue"
              />
              Ativar integração com Focus NFe
            </label>
            <FormField label="API Key">
              <Input
                type="password"
                value={focusKey}
                onChange={(e) => setFocusKey(e.target.value)}
                placeholder="focus_live_••••••••"
                disabled={!focusAtivo}
              />
            </FormField>
          </CardContent>
        </Card>
      </div>
    </SectionWrapper>
  );
}

function EmailsAutomaticos() {
  const [assunto, setAssunto] = useState('NFS-e {{numero_nota}} - {{empresa}}');
  const [remetente, setRemetente] = useState('nfe@oliveiratech.com.br');
  const [cc, setCc] = useState('contabil@primegestao.com.br');
  const [corpo, setCorpo] = useState(
    'Olá {{nome_destinatario}},\n\nSegue em anexo a NFS-e nº {{numero_nota}} no valor de {{valor}}.\n\nVocê também pode baixar a nota em: {{link_pdf}}\n\nAtenciosamente,\n{{empresa}}',
  );

  const VARS = [
    '{{nome_destinatario}}',
    '{{numero_nota}}',
    '{{valor}}',
    '{{link_pdf}}',
    '{{empresa}}',
  ];

  return (
    <SectionWrapper
      title="E-mails automáticos"
      description="Template enviado ao destinatário quando uma nota é autorizada."
    >
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Assunto" required className="md:col-span-2">
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            </FormField>
            <FormField label="Remetente (e-mail padrão)" required>
              <Input
                type="email"
                value={remetente}
                onChange={(e) => setRemetente(e.target.value)}
              />
            </FormField>
            <FormField label="CC padrão">
              <Input value={cc} onChange={(e) => setCc(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Corpo do e-mail" required>
            <textarea
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={10}
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </FormField>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variáveis disponíveis
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(v).catch(() => undefined);
                    }
                    toast.success(`Variável ${v} copiada`);
                  }}
                  className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs hover:bg-muted"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => toast.success(`E-mail de teste enviado para ${remetente} (mock)`)}
            >
              Testar envio
            </Button>
            <Button onClick={() => toast.success('Template salvo (mock)')}>Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </SectionWrapper>
  );
}

function Preferencias() {
  const [formatoData, setFormatoData] = useState<'BR' | 'ISO'>('BR');
  const [tema, setTema] = useState<'claro' | 'escuro' | 'sistema'>('claro');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [notifSino, setNotifSino] = useState(true);

  return (
    <SectionWrapper title="Preferências" description="Ajustes de exibição e canais de notificação.">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Moeda">
              <select
                value="BRL"
                disabled
                className="h-10 w-full rounded-md border border-input bg-muted/40 px-3 text-sm"
              >
                <option value="BRL">Real (R$)</option>
              </select>
            </FormField>
            <FormField label="Fuso horário">
              <select
                value="sp"
                disabled
                className="h-10 w-full rounded-md border border-input bg-muted/40 px-3 text-sm"
              >
                <option value="sp">America/Sao_Paulo (BRT)</option>
              </select>
            </FormField>
            <FormField label="Idioma">
              <select
                value="pt-BR"
                disabled
                className="h-10 w-full rounded-md border border-input bg-muted/40 px-3 text-sm"
              >
                <option value="pt-BR">Português (Brasil)</option>
              </select>
            </FormField>
            <FormField label="Formato de data">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={formatoData === 'BR'}
                    onChange={() => setFormatoData('BR')}
                    className="h-4 w-4 accent-brand-blue"
                  />
                  DD/MM/AAAA
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={formatoData === 'ISO'}
                    onChange={() => setFormatoData('ISO')}
                    className="h-4 w-4 accent-brand-blue"
                  />
                  AAAA-MM-DD
                </label>
              </div>
            </FormField>
          </div>

          <Separator />

          <FormField label="Tema">
            <div className="flex gap-4">
              {[
                { v: 'claro' as const, l: 'Claro' },
                { v: 'escuro' as const, l: 'Escuro' },
                { v: 'sistema' as const, l: 'Sistema' },
              ].map((opt) => (
                <label key={opt.v} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={tema === opt.v}
                    onChange={() => setTema(opt.v)}
                    className="h-4 w-4 accent-brand-blue"
                  />
                  {opt.l}
                </label>
              ))}
            </div>
          </FormField>

          <Separator />

          <div>
            <span className="text-sm font-medium">Notificações</span>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifEmail}
                  onChange={(e) => setNotifEmail(e.target.checked)}
                  className="h-4 w-4 accent-brand-blue"
                />
                E-mail
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifPush}
                  onChange={(e) => setNotifPush(e.target.checked)}
                  className="h-4 w-4 accent-brand-blue"
                />
                Push (navegador)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifSino}
                  onChange={(e) => setNotifSino(e.target.checked)}
                  className="h-4 w-4 accent-brand-blue"
                />
                Sino no aplicativo
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => toast.success('Preferências salvas (mock)')}>Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </SectionWrapper>
  );
}

function PlanoAssinatura() {
  const usoNotas = 184;
  const limiteNotas = 500;
  const pct = Math.round((usoNotas / limiteNotas) * 100);

  return (
    <SectionWrapper
      title="Plano e assinatura"
      description="Gerencie limites e consulte o histórico de cobranças."
    >
      <Card className="border-brand-blue/40 bg-brand-blue/5">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue">
                Plano atual
              </span>
              <h3 className="text-2xl font-bold">Profissional</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Até 500 notas/mês · 2 usuários · 1 empresa
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-brand-blue">
                <Money value={149} /> <span className="text-sm font-normal">/ mês</span>
              </div>
              <Button className="mt-2" onClick={() => toast.info('Upgrade (mock)')}>
                Fazer upgrade
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">Uso no mês atual</span>
              <span className="tabular-nums text-muted-foreground">
                {usoNotas} / {limiteNotas} notas ({pct}%)
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  pct < 70 && 'bg-brand-green',
                  pct >= 70 && pct < 90 && 'bg-brand-warning',
                  pct >= 90 && 'bg-brand-danger',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Histórico de faturas</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
              <th className="px-4 py-3 font-semibold">Valor</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {HISTORICO.map((f) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="px-4 py-3">{f.data}</td>
                <td className="px-4 py-3">{f.descricao}</td>
                <td className="px-4 py-3">
                  <Money value={f.valor} />
                </td>
                <td className="px-4 py-3">
                  <Badge variant={f.status === 'pago' ? 'success' : 'warning'}>
                    {f.status === 'pago'
                      ? 'Pago'
                      : f.status === 'pendente'
                        ? 'Pendente'
                        : 'Vencido'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info('Download iniciado (mock)')}
                  >
                    Baixar boleto
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info('Download de NF (mock)')}
                  >
                    Nota
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </SectionWrapper>
  );
}

function UsuariosAtalho() {
  const user = useMockUser();
  const empresa = useMemo(
    () => empresas.find((e) => e.id === user.empresaAtivaId) ?? empresas[0],
    [user.empresaAtivaId],
  );
  const vinculo = empresa?.nomeFantasia ?? 'Oliveira Tech';
  return (
    <SectionWrapper title="Usuários da empresa">
      <Card>
        <CardContent className="flex flex-col items-start gap-4 pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold">Gestão centralizada</h3>
            <p className="text-sm text-muted-foreground">
              Gerencie usuários desta empresa na tela dedicada com filtros e matriz de permissões.
            </p>
          </div>
          <Button asChild>
            <Link href={`/usuarios?vinculo=${encodeURIComponent(vinculo)}`}>
              Ir para Usuários
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </SectionWrapper>
  );
}

export function ConfigClient() {
  const [secao, setSecao] = useState<SecaoKey>('dados');
  const [menuOpen, setMenuOpen] = useState(false);

  const secaoAtiva = SECOES.find((s) => s.key === secao) ?? SECOES[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Dados da empresa, certificado, séries, integrações, e-mails, plano e mais.
        </p>
      </div>

      {/* Mobile — accordion de seções */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-md border bg-card px-4 py-3 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            {secaoAtiva ? <secaoAtiva.icon className="h-4 w-4" /> : null}
            {secaoAtiva?.label ?? '—'}
          </span>
          <ChevronRight
            className={cn('h-4 w-4 transition-transform', menuOpen && 'rotate-90')}
            aria-hidden
          />
        </button>
        {menuOpen ? (
          <Card className="mt-2 overflow-hidden p-0">
            <ul>
              {SECOES.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSecao(s.key);
                        setMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm last:border-0',
                        secao === s.key && 'bg-muted',
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{s.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </div>

      {/* Desktop — 2 colunas */}
      <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden md:block">
          <Card className="overflow-hidden p-0">
            <ul>
              {SECOES.map((s) => {
                const Icon = s.icon;
                const active = secao === s.key;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => setSecao(s.key)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0',
                        active ? 'bg-brand-blue/10 text-brand-blue' : 'hover:bg-muted/50',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 mt-0.5 shrink-0',
                          active ? 'text-brand-blue' : 'text-muted-foreground',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{s.descricao}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>

        <section className="min-w-0">
          {secao === 'dados' ? <DadosEmpresa /> : null}
          {secao === 'certificado' ? <CertificadoDigital /> : null}
          {secao === 'series' ? <SeriesNotas /> : null}
          {secao === 'integracoes' ? <Integracoes /> : null}
          {secao === 'emails' ? <EmailsAutomaticos /> : null}
          {secao === 'preferencias' ? <Preferencias /> : null}
          {secao === 'plano' ? <PlanoAssinatura /> : null}
          {secao === 'usuarios' ? <UsuariosAtalho /> : null}
        </section>
      </div>
    </div>
  );
}
