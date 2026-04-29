import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Money,
  Separator,
  StatusPill,
} from '@nexo/ui';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FilePlus2,
  FileText,
  KeyRound,
  PackageCheck,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Design system' };

const brandTokens = [
  { name: 'Azul Nexo', token: 'brand.blue', hex: '#1E5FD8', className: 'bg-brand-blue' },
  {
    name: 'Azul escuro',
    token: 'brand.blue-dark',
    hex: '#1748A8',
    className: 'bg-brand-blue-dark',
  },
  { name: 'Verde fiscal', token: 'brand.green', hex: '#1BA97A', className: 'bg-brand-green' },
  { name: 'Perigo', token: 'brand.danger', hex: '#E54848', className: 'bg-brand-danger' },
  { name: 'Atenção', token: 'brand.warning', hex: '#F59E0B', className: 'bg-brand-warning' },
  { name: 'Informação', token: 'brand.info', hex: '#3B82F6', className: 'bg-brand-info' },
];

const neutralTokens = [
  { name: 'Texto principal', value: 'foreground' },
  { name: 'Texto secundário', value: 'muted-foreground' },
  { name: 'Fundo', value: 'background' },
  { name: 'Superfície', value: 'card' },
  { name: 'Borda', value: 'border' },
];

const statusExamples = [
  'autorizada',
  'rejeitada',
  'cancelada',
  'pendente',
  'processando',
  'rascunho',
] as const;

const tableRows = [
  {
    doc: 'NFS-e 1842',
    client: 'Clínica Boa Vista Ltda.',
    status: 'autorizada' as const,
    amount: 1280,
    time: 'Emitida em 8s',
  },
  {
    doc: 'NF-e 778',
    client: 'Mercado Central Sul',
    status: 'processando' as const,
    amount: 6240.9,
    time: 'Aguardando SEFAZ',
  },
  {
    doc: 'NF-e 779',
    client: 'Oficina Rota 12',
    status: 'rejeitada' as const,
    amount: 890,
    time: 'Rejeição 611',
  },
];

function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}

function TokenCard({
  name,
  token,
  value,
  className,
}: {
  name: string;
  token: string;
  value: string;
  className: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`h-14 w-14 rounded-md border ${className}`} />
        <div className="min-w-0">
          <p className="font-medium text-foreground">{name}</p>
          <p className="font-mono text-xs text-muted-foreground">{token}</p>
          <p className="font-mono text-xs text-muted-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="space-y-10 pb-12">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="space-y-4">
          <Badge variant="secondary" className="w-fit">
            Nexo Fiscal Design System
          </Badge>
          <div className="max-w-4xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-normal text-foreground">
              Interface fiscal clara, rápida e auditável
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">
              Tokens e componentes para telas de emissão, consulta, importação de XML, estoque,
              alertas e auditoria. O visual prioriza leitura rápida, estados fiscais inequívocos e
              formulários densos sem perder respiro.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button>
              <FilePlus2 className="h-4 w-4" />
              Emitir nota
            </Button>
            <Button variant="outline">
              <Upload className="h-4 w-4" />
              Importar XML
            </Button>
            <Button variant="ghost">
              <Eye className="h-4 w-4" />
              Ver auditoria
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Princípios de produto</CardTitle>
            <CardDescription>Critérios para qualquer nova tela fiscal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-green" />
              <span>Uma ação principal por contexto operacional.</span>
            </div>
            <div className="flex gap-3">
              <Clock3 className="mt-0.5 h-4 w-4 text-brand-info" />
              <span>Tempo, status e retorno da SEFAZ sempre visíveis.</span>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-blue" />
              <span>Dados sensíveis tratados com linguagem objetiva e rastreável.</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Fundação" title="Cores e tokens">
          A paleta usa azul como navegação e confiança, verde para conclusão fiscal, vermelho para
          erro bloqueante, amarelo para pendência e cinzas para estrutura.
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brandTokens.map((token) => (
            <TokenCard
              key={token.token}
              name={token.name}
              token={token.token}
              value={token.hex}
              className={token.className}
            />
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {neutralTokens.map((token) => (
            <div key={token.value} className="rounded-md border bg-card p-3">
              <p className="text-sm font-medium">{token.name}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{token.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Tipografia" title="Hierarquia para telas densas">
          Inter sustenta a interface geral. JetBrains Mono e números tabulares entram em CNPJ,
          chaves de acesso, valores monetários, séries e protocolos.
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Título de página
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-normal">Documentos fiscais</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Texto de apoio
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Consulte notas emitidas, eventos, XML autorizado e representação visual em PDF.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dados fiscais
                </p>
                <p className="mt-2 font-mono text-lg tabular-nums">
                  35 2404 1234 5600 0199 5500 1000 0007 7810 0007 7817
                </p>
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="font-mono text-sm tabular-nums">12.345.678/0001-90</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Série</p>
                  <p className="font-mono text-sm tabular-nums">001</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <Money value={1280} className="font-mono text-sm tabular-nums" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Componentes" title="Ações, estados e feedback">
          Componentes devem deixar claro o próximo passo, o risco fiscal e o estado atual do
          documento sem depender apenas de cor.
        </SectionTitle>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Botões</CardTitle>
              <CardDescription>Ações frequentes com ícones Lucide.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button>
                <FilePlus2 className="h-4 w-4" />
                Emitir
              </Button>
              <Button variant="success">
                <CheckCircle2 className="h-4 w-4" />
                Autorizar
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4" />
                XML
              </Button>
              <Button variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                Cancelar
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status fiscal</CardTitle>
              <CardDescription>Usar em listas, detalhe da nota e timeline.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {statusExamples.map((status) => (
                <StatusPill key={status} status={status} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>Marcadores curtos para contexto de operação.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>Produção</Badge>
              <Badge variant="secondary">Homologação</Badge>
              <Badge variant="success">Sincronizado</Badge>
              <Badge variant="warning">Pendente</Badge>
              <Badge variant="destructive">Bloqueante</Badge>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Formulários" title="Campos para emissão em menos de um minuto">
          Layouts fiscais precisam ser escaneáveis em desktop, com grupos curtos, validação próxima
          do campo e comandos previsíveis.
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Nota fiscal de serviço</CardTitle>
              <CardDescription>Exemplo de bloco de emissão com dados essenciais.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2" htmlFor="ds-tomador">
                <span className="text-sm font-medium">Tomador</span>
                <Input id="ds-tomador" defaultValue="Clínica Boa Vista Ltda." />
              </label>
              <label className="space-y-2" htmlFor="ds-cnpj">
                <span className="text-sm font-medium">CNPJ</span>
                <Input
                  id="ds-cnpj"
                  className="font-mono tabular-nums"
                  defaultValue="12.345.678/0001-90"
                />
              </label>
              <label className="space-y-2 md:col-span-2" htmlFor="ds-servico">
                <span className="text-sm font-medium">Serviço</span>
                <Input
                  id="ds-servico"
                  defaultValue="Consultoria fiscal e implantação operacional"
                />
              </label>
              <label className="space-y-2" htmlFor="ds-valor">
                <span className="text-sm font-medium">Valor</span>
                <Input
                  id="ds-valor"
                  className="font-mono tabular-nums"
                  defaultValue="R$ 1.280,00"
                />
              </label>
              <label className="space-y-2" htmlFor="ds-codigo-municipal">
                <span className="text-sm font-medium">Código municipal</span>
                <Input
                  id="ds-codigo-municipal"
                  className="font-mono tabular-nums"
                  defaultValue="17.01"
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
              <CardDescription>Critérios antes da transmissão.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-brand-green" />
                Certificado A1 válido
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-brand-green" />
                Tomador sem duplicidade
              </div>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-brand-warning" />
                Alíquota aguardando conferência
              </div>
              <Button className="mt-2 w-full">
                Transmitir agora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <SectionTitle eyebrow="Padrões fiscais" title="Listas, auditoria e segurança">
          Tabelas devem priorizar documento, cliente, status, valor e ação direta. Campos sensíveis
          aparecem mascarados quando a leitura completa não é necessária.
        </SectionTitle>
        <Card>
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Documentos recentes</CardTitle>
              <CardDescription>
                Modelo para consulta operacional e triagem de rejeições.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="w-56 pl-9" placeholder="Buscar nota" />
              </div>
              <Button variant="outline" size="icon" aria-label="Exportar XML">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Documento</th>
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    <th className="px-4 py-3 font-semibold">Retorno</th>
                    <th className="px-4 py-3 text-right font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tableRows.map((row) => (
                    <tr key={row.doc} className="bg-card">
                      <td className="px-4 py-3 font-medium">{row.doc}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.client}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        <Money value={row.amount} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.time}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" aria-label={`Abrir ${row.doc}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-3 p-5">
              <KeyRound className="h-5 w-5 text-brand-blue" />
              <h3 className="font-semibold">Certificado A1</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Nunca exibir senha, buffer PFX ou XML completo em componentes de cliente.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <FileText className="h-5 w-5 text-brand-green" />
              <h3 className="font-semibold">XML como fonte</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                DANFE e DANFSE são representações; o XML autorizado orienta a interface.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <PackageCheck className="h-5 w-5 text-brand-warning" />
              <h3 className="font-semibold">Estoque simplificado</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Entradas via XML e devoluções precisam mostrar impacto previsto antes de salvar.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
