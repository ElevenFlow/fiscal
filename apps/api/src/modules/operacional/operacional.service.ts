import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AlertasQuery, DocumentoExportInput, DocumentoFiscalQuery } from '@nexo/shared';
import { BusinessException } from '../../common/business.exception';
import { PrismaService } from '../../db/prisma.service';
import { getCurrentTenant } from '../../db/tenant-context';

type NotaRow = Prisma.NotaFiscalGetPayload<{ include: { eventos: true } }>;
type DocumentoResumo = {
  id: string;
  modelo: string;
  modeloLabel: string;
  ambiente: string;
  serie: number;
  numero: string | null;
  chaveAcesso: string | null;
  status: string;
  statusLabel: string;
  participanteNome: string | null;
  valorTotal: number;
  protocoloAutorizacao: string | null;
  xmlDisponivel: boolean;
  pdfDisponivel: boolean;
  emitidaEm: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: Array<{
    id: string;
    action: string;
    status: string;
    mensagem: string | null;
    createdAt: string;
  }>;
};
type AlertaResumo = {
  id: string;
  tipo: 'certificado' | 'documento' | 'estoque';
  severidade: 'critico' | 'atencao' | 'info';
  titulo: string;
  descricao: string;
  destinoAcao: string;
  createdAt: string;
  resolvido: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  SIGNING: 'Assinando',
  TRANSMITTING: 'Transmitindo',
  PENDING_RESPONSE: 'Pendente',
  AUTHORIZED: 'Autorizada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
};

@Injectable()
export class OperacionalService {
  constructor(private readonly prisma: PrismaService) {}

  async listDocumentos(query: DocumentoFiscalQuery): Promise<DocumentoResumo[]> {
    const tenantId = this.requireTenant();
    const where: Prisma.NotaFiscalWhereInput = { tenantId };
    if (query.tipo && query.tipo !== 'todos') where.modelo = query.tipo;
    if (query.status) where.status = query.status;
    if (query.dataInicio || query.dataFim) {
      where.createdAt = {};
      if (query.dataInicio) where.createdAt.gte = new Date(query.dataInicio);
      if (query.dataFim) where.createdAt.lte = new Date(query.dataFim);
    }

    const rows = await this.prisma.notaFiscal.findMany({
      where,
      include: { eventos: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    return rows.map((row) => this.serializeDocumento(row)).filter((doc) => this.matchDocumento(doc, query));
  }

  async exportDocumentos(dto: DocumentoExportInput): Promise<unknown> {
    const tenantId = this.requireTenant();
    const rows = await this.prisma.notaFiscal.findMany({
      where: { tenantId, id: { in: dto.ids } },
      include: { eventos: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    const docs = rows.map((row) => this.serializeDocumento(row));
    if (dto.formato === 'zip') {
      return {
        formato: 'zip',
        disponivel: false,
        pendencia: 'PEND-022',
        message: 'Exportacao ZIP real depende de empacotamento/armazenamento temporario e foi diferida.',
        documentos: docs.length,
      };
    }
    const header = 'tipo,numero,serie,status,participante,valor,emissao';
    const lines = docs.map((doc) =>
      [
        doc.modeloLabel,
        doc.numero ?? '',
        doc.serie,
        doc.statusLabel,
        `"${String(doc.participanteNome ?? '').replace(/"/g, '""')}"`,
        doc.valorTotal.toFixed(2),
        doc.emitidaEm ?? doc.createdAt,
      ].join(','),
    );
    return {
      formato: 'csv',
      filename: `documentos-${new Date().toISOString().slice(0, 10)}.csv`,
      content: [header, ...lines].join('\n'),
    };
  }

  async listAlertas(query: AlertasQuery): Promise<AlertaResumo[]> {
    const alertas = await this.buildAlertas();
    return alertas.filter((alerta) => {
      if (query.severidade && alerta.severidade !== query.severidade) return false;
      if (query.tipo && alerta.tipo !== query.tipo) return false;
      if ((query.status ?? 'aberto') === 'aberto' && alerta.resolvido) return false;
      if (query.status === 'resolvido' && !alerta.resolvido) return false;
      return true;
    });
  }

  async resolverAlerta(id: string): Promise<unknown> {
    return {
      id,
      resolvido: true,
      persistido: false,
      pendencia: 'PEND-023',
      message: 'Resolucao persistente de alertas sera gravada em tabela propria na etapa de hardening.',
    };
  }

  async dashboard(): Promise<unknown> {
    const tenantId = this.requireTenant();
    const [docs, alertas, empresas, movimentos] = await Promise.all([
      this.listDocumentos({ tipo: 'todos' }),
      this.buildAlertas(),
      this.prisma.empresa.count({ where: { ativo: true } }),
      this.prisma.movimentacaoEstoque.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const now = new Date();
    const docsMes = docs.filter((doc) => {
      const d = new Date(doc.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const faturamentoMes = docsMes
      .filter((doc) => doc.status === 'AUTHORIZED')
      .reduce((sum, doc) => sum + doc.valorTotal, 0);
    const abertos = alertas.filter((alerta) => !alerta.resolvido);

    return {
      admin: {
        empresas,
        documentosMes: docsMes.length,
        alertasCriticos: abertos.filter((alerta) => alerta.severidade === 'critico').length,
        atividadeRecente: docs.slice(0, 8),
      },
      contabilidade: {
        empresas,
        notasHoje: docs.filter((doc) => new Date(doc.createdAt).toDateString() === now.toDateString()).length,
        pendenciasAtivas: abertos.length,
        certificadosVencendo: abertos.filter((alerta) => alerta.tipo === 'certificado').length,
        empresasAtencao: this.empresasAtencao(alertas),
      },
      empresa: {
        notasMes: docsMes.length,
        faturamentoMes,
        rejeitadasPendentes: docs.filter((doc) => doc.status === 'REJECTED').length,
        estoqueCritico: abertos.filter((alerta) => alerta.tipo === 'estoque').length,
        ultimasNotas: docs.slice(0, 8),
        ultimasMovimentacoes: movimentos.map((mov) => ({
          id: mov.id,
          produto: mov.produtoDescricao,
          tipo: mov.tipo,
          quantidade: Number(mov.quantidade),
          createdAt: mov.createdAt.toISOString(),
        })),
      },
      alertas,
    };
  }

  private async buildAlertas(): Promise<AlertaResumo[]> {
    const tenantId = this.requireTenant();
    const [certs, notas, produtos, saldos] = await Promise.all([
      this.prisma.certificadoDigital.findMany({ where: { tenantId, ativo: true } }),
      this.prisma.notaFiscal.findMany({
        where: { tenantId, status: { in: ['REJECTED', 'PENDING_RESPONSE', 'TRANSMITTING'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.produto.findMany({
        where: { tenantId, ativo: true, estoqueMinimo: { not: null } },
        select: { id: true, codigo: true, descricao: true, estoqueMinimo: true },
      }),
      this.prisma.movimentacaoEstoque.groupBy({
        by: ['produtoId'],
        where: { tenantId, produtoId: { not: null } },
        _sum: { quantidade: true },
      }),
    ]);

    const saldoByProduto = new Map(saldos.map((row) => [row.produtoId, Number(row._sum.quantidade ?? 0)]));
    const alertas: AlertaResumo[] = [];
    for (const cert of certs) {
      const dias = Math.ceil((cert.notAfter.getTime() - Date.now()) / 86_400_000);
      if (dias <= 60) {
        alertas.push({
          id: `cert-${cert.id}`,
          tipo: 'certificado',
          severidade: dias <= 7 ? 'critico' : 'atencao',
          titulo: dias < 0 ? 'Certificado digital vencido' : `Certificado vence em ${dias} dias`,
          descricao: `Certificado ${cert.cn} expira em ${cert.notAfter.toLocaleDateString('pt-BR')}.`,
          destinoAcao: '/configuracoes/certificado',
          createdAt: cert.notAfter.toISOString(),
          resolvido: false,
        });
      }
    }
    for (const nota of notas) {
      alertas.push({
        id: `nota-${nota.id}`,
        tipo: 'documento',
        severidade: nota.status === 'REJECTED' ? 'critico' : 'atencao',
        titulo: `${this.modeloLabel(nota.modelo)} ${nota.numero?.toString() ?? nota.id.slice(0, 8)} ${STATUS_LABEL[nota.status] ?? nota.status}`,
        descricao: nota.rejeicaoMensagem ?? 'Documento fiscal requer acompanhamento operacional.',
        destinoAcao: '/documentos',
        createdAt: nota.updatedAt.toISOString(),
        resolvido: false,
      });
    }
    for (const produto of produtos) {
      const minimo = Number(produto.estoqueMinimo ?? 0);
      const saldo = saldoByProduto.get(produto.id) ?? 0;
      if (minimo > 0 && saldo < minimo) {
        alertas.push({
          id: `estoque-${produto.id}`,
          tipo: 'estoque',
          severidade: saldo < 0 ? 'critico' : 'atencao',
          titulo: `${produto.descricao} abaixo do minimo`,
          descricao: `SKU ${produto.codigo}: saldo ${saldo}, minimo ${minimo}.`,
          destinoAcao: '/estoque',
          createdAt: new Date().toISOString(),
          resolvido: false,
        });
      }
    }
    return alertas.sort((a, b) => this.severityRank(a.severidade) - this.severityRank(b.severidade));
  }

  private serializeDocumento(row: NotaRow): DocumentoResumo {
    const payload = this.payloadRecord(row.payload);
    return {
      id: row.id,
      modelo: row.modelo,
      modeloLabel: this.modeloLabel(row.modelo),
      ambiente: row.ambiente,
      serie: row.serie,
      numero: row.numero?.toString() ?? null,
      chaveAcesso: row.chaveAcesso,
      status: row.status,
      statusLabel: STATUS_LABEL[row.status] ?? row.status,
      participanteNome: this.extractParticipante(payload),
      valorTotal: this.extractValor(payload),
      protocoloAutorizacao: row.protocoloAutorizacao,
      xmlDisponivel: Boolean(row.xmlAutorizadoS3Key || this.xmlFromPayload(payload)),
      pdfDisponivel: ['AUTHORIZED', 'CANCELLED'].includes(row.status),
      emitidaEm: row.emitidaEm?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      timeline: row.eventos.map((evento) => ({
        id: evento.id,
        action: evento.action,
        status: evento.status,
        mensagem: evento.mensagem,
        createdAt: evento.createdAt.toISOString(),
      })),
    };
  }

  private matchDocumento(doc: DocumentoResumo, query: DocumentoFiscalQuery): boolean {
    if (query.valorMin !== undefined && doc.valorTotal < query.valorMin) return false;
    if (query.valorMax !== undefined && doc.valorTotal > query.valorMax) return false;
    if (!query.search) return true;
    const term = query.search.toLowerCase();
    return [doc.numero, doc.chaveAcesso, doc.participanteNome, doc.modeloLabel]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  }

  private empresasAtencao(alertas: AlertaResumo[]) {
    if (alertas.length === 0) return [];
    return [
      {
        empresa: 'Empresa atual',
        criticos: alertas.filter((alerta) => alerta.severidade === 'critico').length,
        atencao: alertas.filter((alerta) => alerta.severidade === 'atencao').length,
      },
    ];
  }

  private requireTenant(): string {
    const tenantId = getCurrentTenant()?.tenantId ?? null;
    if (!tenantId) {
      throw new BusinessException('NO_TENANT', 'Empresa ativa requerida para a visao operacional.', 400);
    }
    return tenantId;
  }

  private payloadRecord(payload: Prisma.JsonValue): Record<string, unknown> {
    return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  }

  private extractParticipante(payload: Record<string, unknown>): string | null {
    const values = [payload.destinatario, payload.tomador, payload.cliente, payload.fornecedor];
    for (const value of values) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        const nome = record.nome ?? record.razaoSocial ?? record.xNome;
        if (typeof nome === 'string') return nome;
      }
    }
    return null;
  }

  private extractValor(payload: Record<string, unknown>): number {
    const direct = payload.valorTotal ?? payload.valorServicos ?? payload.total;
    if (typeof direct === 'number') return direct;
    if (typeof direct === 'string') return Number(direct) || 0;
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      const record = direct as Record<string, unknown>;
      const total = record.vNF ?? record.valor;
      if (typeof total === 'number') return total;
      if (typeof total === 'string') return Number(total) || 0;
    }
    return 0;
  }

  private xmlFromPayload(payload: Record<string, unknown>): string | null {
    for (const key of ['xmlAutorizado', 'xmlAssinado', 'xml']) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().startsWith('<')) return value;
    }
    return null;
  }

  private modeloLabel(modelo: string): string {
    if (modelo === 'NFE_55') return 'NF-e';
    if (modelo === 'NFSE') return 'NFS-e';
    if (modelo === 'DEVOLUCAO') return 'Devolucao';
    return modelo;
  }

  private severityRank(severidade: string): number {
    if (severidade === 'critico') return 0;
    if (severidade === 'atencao') return 1;
    return 2;
  }
}
