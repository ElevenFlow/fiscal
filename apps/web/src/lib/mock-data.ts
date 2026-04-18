/**
 * Mock data — fixtures brasileiros realistas usados no MODO PROTÓTIPO.
 *
 * Todo o front roda 100% sobre este arquivo enquanto o backend fica idle.
 * Quando formos para produção, estes fixtures viram seeds do Postgres (apps/api)
 * e os componentes passarão a consumir RSC/Server Actions em vez de import direto.
 */

// ============================================================================
// TIPOS
// ============================================================================

export type Role = 'admin' | 'contabilidade' | 'empresa';

export type NotaTipo = 'NFS-e' | 'NF-e' | 'NF-e Dev';
export type NotaStatus = 'autorizada' | 'rejeitada' | 'cancelada' | 'pendente' | 'processando';
export type AlertaSeveridade = 'critico' | 'atencao' | 'info';

export interface Contabilidade {
  id: string;
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  uf: string;
  carteira: number;
  responsavel: string;
}

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  regime: 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real' | 'MEI';
  uf: string;
  cidade: string;
  status: 'ativa' | 'pendente' | 'suspensa';
  ultimoAcesso: string;
  contabilidadeId: string;
}

export interface Cliente {
  id: string;
  tipo: 'PF' | 'PJ';
  documento: string;
  nome: string;
  email?: string;
  telefone?: string;
  cidade: string;
  uf: string;
  ultimaCompra?: string;
}

export interface Fornecedor {
  id: string;
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  uf: string;
  totalCompras12m: number;
  ultimaCompra: string;
}

export interface Produto {
  id: string;
  sku: string;
  descricao: string;
  ncm: string;
  cest?: string;
  unidade: string;
  precoCusto: number;
  precoVenda: number;
  estoque: number;
  estoqueMinimo: number;
  categoria: string;
}

export interface Servico {
  id: string;
  codigo: string;
  descricao: string;
  codigoMunicipal: string;
  aliquotaIss: number;
  precoPadrao: number;
  ativo: boolean;
}

export interface NotaFiscal {
  id: string;
  tipo: NotaTipo;
  numero: string;
  serie: string;
  data: string; // DD/MM/AAAA
  destinatarioNome: string;
  valor: number;
  status: NotaStatus;
  chaveAcesso?: string;
  empresaId: string;
}

export interface MovimentacaoEstoque {
  id: string;
  data: string; // DD/MM/AAAA
  produtoSku: string;
  produtoDescricao: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  origem: string;
  saldoApos: number;
}

export interface Alerta {
  id: string;
  severidade: AlertaSeveridade;
  titulo: string;
  descricao: string;
  empresa?: string;
  data: string; // DD/MM/AAAA HH:mm
  resolvido: boolean;
}

export interface Log {
  id: string;
  dataHora: string; // DD/MM/AAAA HH:mm:ss
  usuario: string;
  acao: string;
  entidade: string;
  ip?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Role;
  vinculo?: string;
  status: 'ativo' | 'convidado' | 'bloqueado';
  ultimoAcesso?: string;
}

// Compat legado — componentes shell ainda consomem estes.
export interface MockEmpresa {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente: 'producao' | 'homologacao';
}

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface MockNotification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  time: string;
}

// ============================================================================
// FIXTURES
// ============================================================================

export const contabilidades: Contabilidade[] = [
  {
    id: 'c-1',
    razaoSocial: 'Prime Gestão Contábil LTDA',
    cnpj: '05.123.456/0001-77',
    cidade: 'São Paulo',
    uf: 'SP',
    carteira: 28,
    responsavel: 'Beatriz Prado',
  },
  {
    id: 'c-2',
    razaoSocial: 'Alfa Assessoria Contábil ME',
    cnpj: '08.987.654/0001-33',
    cidade: 'Campinas',
    uf: 'SP',
    carteira: 19,
    responsavel: 'Marcelo Teixeira',
  },
  {
    id: 'c-3',
    razaoSocial: 'Sigma Contabilidade S/S',
    cnpj: '11.222.333/0001-80',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    carteira: 34,
    responsavel: 'Luciana Almeida',
  },
  {
    id: 'c-4',
    razaoSocial: 'Horizonte Contábil e Tributária',
    cnpj: '15.444.555/0001-21',
    cidade: 'Curitiba',
    uf: 'PR',
    carteira: 12,
    responsavel: 'Rafael Nogueira',
  },
];

export const empresas: Empresa[] = [
  {
    id: 'e-1',
    razaoSocial: 'Oliveira Tech Soluções LTDA',
    nomeFantasia: 'Oliveira Tech',
    cnpj: '12.345.678/0001-90',
    regime: 'Simples Nacional',
    uf: 'SP',
    cidade: 'São Paulo',
    status: 'ativa',
    ultimoAcesso: '18/04/2026 09:12',
    contabilidadeId: 'c-1',
  },
  {
    id: 'e-2',
    razaoSocial: 'Clínica Vida Integral ME',
    nomeFantasia: 'Clínica Vida Integral',
    cnpj: '23.456.789/0001-12',
    regime: 'Lucro Presumido',
    uf: 'SP',
    cidade: 'Santos',
    status: 'ativa',
    ultimoAcesso: '17/04/2026 18:44',
    contabilidadeId: 'c-1',
  },
  {
    id: 'e-3',
    razaoSocial: 'Solar Engenharia LTDA',
    nomeFantasia: 'Solar Engenharia',
    cnpj: '34.567.890/0001-23',
    regime: 'Lucro Presumido',
    uf: 'MG',
    cidade: 'Belo Horizonte',
    status: 'pendente',
    ultimoAcesso: '15/04/2026 14:02',
    contabilidadeId: 'c-3',
  },
  {
    id: 'e-4',
    razaoSocial: 'Padaria Pão Dourado LTDA',
    nomeFantasia: 'Pão Dourado',
    cnpj: '45.678.901/0001-34',
    regime: 'Simples Nacional',
    uf: 'SP',
    cidade: 'Campinas',
    status: 'ativa',
    ultimoAcesso: '18/04/2026 07:22',
    contabilidadeId: 'c-2',
  },
  {
    id: 'e-5',
    razaoSocial: 'Mercadinho Bom Preço LTDA',
    nomeFantasia: 'Bom Preço',
    cnpj: '56.789.012/0001-45',
    regime: 'Simples Nacional',
    uf: 'PR',
    cidade: 'Curitiba',
    status: 'ativa',
    ultimoAcesso: '18/04/2026 08:58',
    contabilidadeId: 'c-4',
  },
];

export const clientes: Cliente[] = [
  {
    id: 'cl-1',
    tipo: 'PJ',
    documento: '19.876.543/0001-55',
    nome: 'Construtora Horizonte LTDA',
    email: 'financeiro@horizonteconstrutora.com.br',
    telefone: '(11) 3456-7890',
    cidade: 'São Paulo',
    uf: 'SP',
    ultimaCompra: '14/04/2026',
  },
  {
    id: 'cl-2',
    tipo: 'PF',
    documento: '345.678.901-22',
    nome: 'Mariana Souza Estética',
    email: 'mariana.souza@email.com',
    telefone: '(11) 98765-4321',
    cidade: 'São Paulo',
    uf: 'SP',
    ultimaCompra: '12/04/2026',
  },
  {
    id: 'cl-3',
    tipo: 'PJ',
    documento: '28.111.222/0001-66',
    nome: 'Supermercado Bom Preço LTDA',
    email: 'compras@bompreco.com.br',
    telefone: '(41) 3222-4455',
    cidade: 'Curitiba',
    uf: 'PR',
    ultimaCompra: '10/04/2026',
  },
  {
    id: 'cl-4',
    tipo: 'PF',
    documento: '123.456.789-04',
    nome: 'Carlos Ferreira',
    email: 'carlos.ferreira@email.com',
    telefone: '(21) 99988-7766',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
    ultimaCompra: '08/04/2026',
  },
  {
    id: 'cl-5',
    tipo: 'PF',
    documento: '987.654.321-00',
    nome: 'Ana Paula Ribeiro',
    email: 'anapaula.ribeiro@email.com',
    telefone: '(31) 98123-4567',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    ultimaCompra: '05/04/2026',
  },
];

export const fornecedores: Fornecedor[] = [
  {
    id: 'f-1',
    razaoSocial: 'Distribuidora Sul Brasil LTDA',
    cnpj: '77.888.999/0001-10',
    cidade: 'Porto Alegre',
    uf: 'RS',
    totalCompras12m: 184320.5,
    ultimaCompra: '15/04/2026',
  },
  {
    id: 'f-2',
    razaoSocial: 'Atacado Central Paulista S/A',
    cnpj: '88.999.000/0001-21',
    cidade: 'São Paulo',
    uf: 'SP',
    totalCompras12m: 256790.33,
    ultimaCompra: '12/04/2026',
  },
  {
    id: 'f-3',
    razaoSocial: 'Importadora Oriente LTDA',
    cnpj: '99.000.111/0001-32',
    cidade: 'Santos',
    uf: 'SP',
    totalCompras12m: 98540.2,
    ultimaCompra: '02/04/2026',
  },
];

export const produtos: Produto[] = [
  {
    id: 'p-1',
    sku: 'CAB-FLEX-2.5',
    descricao: 'Cabo Flexível 2,5mm² 750V Rolo 100m',
    ncm: '8544.49.00',
    unidade: 'RL',
    precoCusto: 189.9,
    precoVenda: 279.0,
    estoque: 42,
    estoqueMinimo: 15,
    categoria: 'Elétrica',
  },
  {
    id: 'p-2',
    sku: 'TEC-USB-BR01',
    descricao: 'Teclado USB ABNT2 Preto',
    ncm: '8471.60.52',
    unidade: 'UN',
    precoCusto: 39.5,
    precoVenda: 79.9,
    estoque: 86,
    estoqueMinimo: 20,
    categoria: 'Informática',
  },
  {
    id: 'p-3',
    sku: 'CXO-ORG-25L',
    descricao: 'Caixa Organizadora Plástica 25L com Tampa',
    ncm: '3924.90.00',
    unidade: 'UN',
    precoCusto: 22.0,
    precoVenda: 49.9,
    estoque: 134,
    estoqueMinimo: 30,
    categoria: 'Utilidades',
  },
  {
    id: 'p-4',
    sku: 'DIS-20A-BIP',
    descricao: 'Disjuntor Bipolar 20A Curva C',
    ncm: '8536.20.00',
    unidade: 'UN',
    precoCusto: 34.0,
    precoVenda: 62.5,
    estoque: 4,
    estoqueMinimo: 10,
    categoria: 'Elétrica',
  },
  {
    id: 'p-5',
    sku: 'LED-LUM-18W',
    descricao: 'Luminária LED Plafon 18W Branco Frio',
    ncm: '9405.10.99',
    unidade: 'UN',
    precoCusto: 28.0,
    precoVenda: 59.9,
    estoque: 57,
    estoqueMinimo: 20,
    categoria: 'Iluminação',
  },
];

export const servicos: Servico[] = [
  {
    id: 's-1',
    codigo: 'SRV-CONSULT-ADM',
    descricao: 'Consultoria Administrativa Mensal',
    codigoMunicipal: '17.01',
    aliquotaIss: 5,
    precoPadrao: 2500.0,
    ativo: true,
  },
  {
    id: 's-2',
    codigo: 'SRV-INST-TEC',
    descricao: 'Instalação Técnica de Equipamentos',
    codigoMunicipal: '14.01',
    aliquotaIss: 3,
    precoPadrao: 450.0,
    ativo: true,
  },
  {
    id: 's-3',
    codigo: 'SRV-MANUT-PREV',
    descricao: 'Manutenção Preventiva Mensal',
    codigoMunicipal: '14.02',
    aliquotaIss: 3,
    precoPadrao: 780.0,
    ativo: true,
  },
  {
    id: 's-4',
    codigo: 'SRV-DEV-SOFT',
    descricao: 'Desenvolvimento de Software Sob Demanda',
    codigoMunicipal: '01.04',
    aliquotaIss: 2,
    precoPadrao: 6800.0,
    ativo: true,
  },
];

export const notasFiscais: NotaFiscal[] = [
  {
    id: 'nf-1',
    tipo: 'NFS-e',
    numero: '000182',
    serie: 'A',
    data: '18/04/2026',
    destinatarioNome: 'Construtora Horizonte LTDA',
    valor: 2500.0,
    status: 'autorizada',
    empresaId: 'e-1',
  },
  {
    id: 'nf-2',
    tipo: 'NF-e',
    numero: '001244',
    serie: '1',
    data: '17/04/2026',
    destinatarioNome: 'Supermercado Bom Preço LTDA',
    valor: 18950.8,
    status: 'autorizada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 4410 9876 5432',
    empresaId: 'e-1',
  },
  {
    id: 'nf-3',
    tipo: 'NFS-e',
    numero: '000181',
    serie: 'A',
    data: '17/04/2026',
    destinatarioNome: 'Mariana Souza Estética',
    valor: 780.0,
    status: 'rejeitada',
    empresaId: 'e-1',
  },
  {
    id: 'nf-4',
    tipo: 'NF-e',
    numero: '001243',
    serie: '1',
    data: '16/04/2026',
    destinatarioNome: 'Ana Paula Ribeiro',
    valor: 349.9,
    status: 'autorizada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 4310 9988 4455',
    empresaId: 'e-1',
  },
  {
    id: 'nf-5',
    tipo: 'NF-e Dev',
    numero: '001242',
    serie: '1',
    data: '15/04/2026',
    destinatarioNome: 'Distribuidora Sul Brasil LTDA',
    valor: 1420.5,
    status: 'cancelada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 4210 4422 8811',
    empresaId: 'e-1',
  },
  {
    id: 'nf-6',
    tipo: 'NFS-e',
    numero: '000180',
    serie: 'A',
    data: '15/04/2026',
    destinatarioNome: 'Carlos Ferreira',
    valor: 1850.0,
    status: 'pendente',
    empresaId: 'e-1',
  },
  {
    id: 'nf-7',
    tipo: 'NF-e',
    numero: '001241',
    serie: '1',
    data: '14/04/2026',
    destinatarioNome: 'Construtora Horizonte LTDA',
    valor: 9240.0,
    status: 'autorizada',
    chaveAcesso: '3526 0412 3456 7800 0190 5500 1000 0012 4110 7788 6633',
    empresaId: 'e-1',
  },
];

export const movimentacoesEstoque: MovimentacaoEstoque[] = [
  {
    id: 'mv-1',
    data: '17/04/2026',
    produtoSku: 'DIS-20A-BIP',
    produtoDescricao: 'Disjuntor Bipolar 20A Curva C',
    tipo: 'saida',
    quantidade: 6,
    origem: 'NF-e 001244',
    saldoApos: 4,
  },
  {
    id: 'mv-2',
    data: '16/04/2026',
    produtoSku: 'TEC-USB-BR01',
    produtoDescricao: 'Teclado USB ABNT2 Preto',
    tipo: 'entrada',
    quantidade: 50,
    origem: 'Importação XML — Atacado Central',
    saldoApos: 86,
  },
  {
    id: 'mv-3',
    data: '15/04/2026',
    produtoSku: 'CAB-FLEX-2.5',
    produtoDescricao: 'Cabo Flexível 2,5mm² 750V',
    tipo: 'saida',
    quantidade: 8,
    origem: 'NF-e 001241',
    saldoApos: 42,
  },
  {
    id: 'mv-4',
    data: '14/04/2026',
    produtoSku: 'LED-LUM-18W',
    produtoDescricao: 'Luminária LED Plafon 18W',
    tipo: 'ajuste',
    quantidade: -3,
    origem: 'Ajuste manual — inventário',
    saldoApos: 57,
  },
  {
    id: 'mv-5',
    data: '13/04/2026',
    produtoSku: 'CXO-ORG-25L',
    produtoDescricao: 'Caixa Organizadora 25L',
    tipo: 'entrada',
    quantidade: 80,
    origem: 'Importação XML — Distribuidora Sul Brasil',
    saldoApos: 134,
  },
];

export const alertas: Alerta[] = [
  {
    id: 'al-1',
    severidade: 'critico',
    titulo: 'Certificado digital vence em 3 dias',
    descricao: 'Oliveira Tech Soluções LTDA — renove antes de 21/04/2026 para evitar falhas.',
    empresa: 'Oliveira Tech',
    data: '18/04/2026 07:00',
    resolvido: false,
  },
  {
    id: 'al-2',
    severidade: 'critico',
    titulo: 'NFS-e 000181 rejeitada (código 611)',
    descricao: 'Código de serviço municipal incompatível. Ajuste e retransmita.',
    empresa: 'Oliveira Tech',
    data: '17/04/2026 14:22',
    resolvido: false,
  },
  {
    id: 'al-3',
    severidade: 'atencao',
    titulo: 'Estoque mínimo atingido',
    descricao: 'Disjuntor 20A Curva C — saldo 4 un, mínimo 10 un.',
    empresa: 'Oliveira Tech',
    data: '17/04/2026 09:12',
    resolvido: false,
  },
  {
    id: 'al-4',
    severidade: 'atencao',
    titulo: 'Certificado digital vence em 28 dias',
    descricao: 'Clínica Vida Integral — planeje renovação até 16/05/2026.',
    empresa: 'Clínica Vida Integral',
    data: '16/04/2026 08:00',
    resolvido: false,
  },
  {
    id: 'al-5',
    severidade: 'info',
    titulo: '12 XMLs importados com sucesso',
    descricao: 'Lote de compras do fornecedor Atacado Central Paulista processado.',
    empresa: 'Oliveira Tech',
    data: '16/04/2026 10:45',
    resolvido: true,
  },
];

export const logs: Log[] = [
  {
    id: 'lg-1',
    dataHora: '18/04/2026 09:12:04',
    usuario: 'Rodrigo Silva',
    acao: 'Login',
    entidade: 'Autenticação',
    ip: '200.171.88.12',
  },
  {
    id: 'lg-2',
    dataHora: '18/04/2026 09:14:33',
    usuario: 'Rodrigo Silva',
    acao: 'Emissão de NFS-e 000182',
    entidade: 'Nota Fiscal',
    ip: '200.171.88.12',
  },
  {
    id: 'lg-3',
    dataHora: '17/04/2026 18:44:02',
    usuario: 'Beatriz Prado',
    acao: 'Edição de cadastro de cliente',
    entidade: 'Cliente (Construtora Horizonte)',
    ip: '189.45.122.8',
  },
  {
    id: 'lg-4',
    dataHora: '17/04/2026 14:22:18',
    usuario: 'Rodrigo Silva',
    acao: 'Rejeição SEFAZ (código 611)',
    entidade: 'NFS-e 000181',
    ip: '200.171.88.12',
  },
  {
    id: 'lg-5',
    dataHora: '16/04/2026 10:45:51',
    usuario: 'Rodrigo Silva',
    acao: 'Importação em lote de 12 XMLs',
    entidade: 'XML de Compra',
    ip: '200.171.88.12',
  },
  {
    id: 'lg-6',
    dataHora: '15/04/2026 11:05:09',
    usuario: 'Marcelo Teixeira',
    acao: 'Cancelamento de NF-e 001242',
    entidade: 'Nota Fiscal',
    ip: '177.22.33.44',
  },
];

export const usuarios: Usuario[] = [
  {
    id: 'u-1',
    nome: 'Rodrigo Silva',
    email: 'rodrigo@oliveiratech.com.br',
    perfil: 'empresa',
    vinculo: 'Oliveira Tech Soluções LTDA',
    status: 'ativo',
    ultimoAcesso: '18/04/2026 09:12',
  },
  {
    id: 'u-2',
    nome: 'Beatriz Prado',
    email: 'beatriz@primegestao.com.br',
    perfil: 'contabilidade',
    vinculo: 'Prime Gestão Contábil',
    status: 'ativo',
    ultimoAcesso: '17/04/2026 18:44',
  },
  {
    id: 'u-3',
    nome: 'Marcelo Teixeira',
    email: 'marcelo@alfaassessoria.com.br',
    perfil: 'contabilidade',
    vinculo: 'Alfa Assessoria Contábil',
    status: 'ativo',
    ultimoAcesso: '15/04/2026 11:05',
  },
  {
    id: 'u-4',
    nome: 'Fernanda Costa',
    email: 'fernanda@nexofiscal.com.br',
    perfil: 'admin',
    vinculo: 'Plataforma',
    status: 'ativo',
    ultimoAcesso: '18/04/2026 08:30',
  },
  {
    id: 'u-5',
    nome: 'Lucas Martins',
    email: 'lucas@paodourado.com.br',
    perfil: 'empresa',
    vinculo: 'Padaria Pão Dourado',
    status: 'convidado',
  },
  {
    id: 'u-6',
    nome: 'Juliana Ramos',
    email: 'juliana@clinicavida.com.br',
    perfil: 'empresa',
    vinculo: 'Clínica Vida Integral',
    status: 'ativo',
    ultimoAcesso: '17/04/2026 17:22',
  },
];

// ============================================================================
// KPIs agregados pro dashboard
// ============================================================================

export const kpisAdmin = {
  contabilidadesAtivas: 42,
  empresasCadastradas: 687,
  notas30d: 12847,
  mrr: 48320,
};

export const kpisContabilidade = {
  empresasCarteira: 28,
  notasHoje: 73,
  pendenciasAtivas: 6,
  certsVencendo: 2,
};

export const kpisEmpresa = {
  notasMes: 184,
  faturamentoMes: 72450.8,
  rejeitadasPendentes: 2,
  estoqueCritico: 5,
};

// Séries de gráficos
export const emissoesPorDia30d = [
  { dia: '20/03', notas: 398 },
  { dia: '23/03', notas: 412 },
  { dia: '26/03', notas: 445 },
  { dia: '29/03', notas: 390 },
  { dia: '01/04', notas: 468 },
  { dia: '04/04', notas: 512 },
  { dia: '07/04', notas: 481 },
  { dia: '10/04', notas: 536 },
  { dia: '13/04', notas: 502 },
  { dia: '16/04', notas: 548 },
  { dia: '18/04', notas: 492 },
];

export const emissoesPorEmpresa = [
  { empresa: 'Oliveira Tech', notas: 184 },
  { empresa: 'Clínica Vida Integral', notas: 132 },
  { empresa: 'Solar Engenharia', notas: 98 },
  { empresa: 'Pão Dourado', notas: 76 },
  { empresa: 'Mercadinho Bom Preço', notas: 61 },
];

export const faturamentoMensal6m = [
  { mes: 'Nov/25', valor: 54320.1 },
  { mes: 'Dez/25', valor: 61480.5 },
  { mes: 'Jan/26', valor: 58990.0 },
  { mes: 'Fev/26', valor: 66210.75 },
  { mes: 'Mar/26', valor: 69840.4 },
  { mes: 'Abr/26', valor: 72450.8 },
];

// ============================================================================
// COMPAT LEGADO — consumido por componentes shell (empresa-switcher / sino)
// ============================================================================

export const mockEmpresas: MockEmpresa[] = empresas.map((e) => ({
  id: e.id,
  razaoSocial: e.razaoSocial,
  cnpj: e.cnpj,
  ambiente: e.status === 'pendente' ? 'homologacao' : 'producao',
}));

export const mockUser = {
  name: 'Rodrigo Silva',
  email: 'rodrigo@oliveiratech.com.br',
  avatarUrl: null as string | null,
};

export const mockNotifications: {
  criticalCount: number;
  items: MockNotification[];
} = {
  criticalCount: alertas.filter((a) => a.severidade === 'critico' && !a.resolvido).length,
  items: alertas.slice(0, 4).map((a) => ({
    id: a.id,
    severity:
      a.severidade === 'critico' ? 'critical' : a.severidade === 'atencao' ? 'warning' : 'info',
    title: a.titulo,
    time: a.data,
  })),
};
