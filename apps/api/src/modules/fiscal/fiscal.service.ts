import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DevolucaoDraftCreateInput,
  NfeCancelInput,
  NfeDraftCreateInput,
  NfseDraftCreateInput,
} from '@nexo/shared';
import {
  BusinessException,
  DuplicateException,
  ForbiddenResourceException,
  NotFoundResourceException,
} from '../../common/business.exception';
import { PrismaService } from '../../db/prisma.service';
import { getCurrentTenant } from '../../db/tenant-context';
import { FiscalEmissionService } from './fiscal-emission.service';
import { FISCAL_GATEWAY, type FiscalGateway } from './fiscal.gateway';
import { FiscalQueueService } from './fiscal-queue.service';
import { renderDanfePdfFromXml } from './danfe-pdf.renderer';
import { S3Service } from '../storage/s3.service';

type NotaFiscalRow = Prisma.NotaFiscalGetPayload<{ include: { eventos: true } }>;

@Injectable()
export class FiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: FiscalQueueService,
    private readonly emission: FiscalEmissionService,
    private readonly s3: S3Service,
    @Inject(FISCAL_GATEWAY) private readonly gateway: FiscalGateway,
  ) {}

  async statusServico(ambiente: 'HOMOLOGACAO' | 'PRODUCAO'): Promise<unknown> {
    return this.gateway.statusServico(ambiente);
  }

  async list(): Promise<unknown[]> {
    return this.listByModelo('NFE_55');
  }

  async listNfse(): Promise<unknown[]> {
    return this.listByModelo('NFSE');
  }

  async listDevolucoes(): Promise<unknown[]> {
    return this.listByModelo('DEVOLUCAO');
  }

  private async listByModelo(modelo: 'NFE_55' | 'NFSE' | 'DEVOLUCAO'): Promise<unknown[]> {
    const tenantId = this.requireTenant();
    const rows = await this.prisma.notaFiscal.findMany({
      where: { tenantId, modelo },
      include: { eventos: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async findOne(id: string): Promise<unknown> {
    const tenantId = this.requireTenant();
    const row = await this.prisma.notaFiscal.findFirst({
      where: { id, tenantId },
      include: { eventos: { orderBy: { createdAt: 'desc' } } },
    });
    if (!row) throw new NotFoundResourceException('nota_fiscal', id);
    return this.serialize(row);
  }

  async createDraft(dto: NfeDraftCreateInput): Promise<unknown> {
    const tenantId = this.requireTenant();
    if (dto.empresaId !== tenantId) {
      throw new ForbiddenResourceException('Nao e permitido emitir NF-e para outra empresa.');
    }

    if (dto.serieFiscalId) {
      const serie = await this.prisma.serieFiscal.findFirst({
        where: {
          id: dto.serieFiscalId,
          tenantId,
          modelo: 'NFE_55',
          serie: dto.serie,
          ambiente: dto.ambiente,
          ativa: true,
        },
      });
      if (!serie) {
        throw new BusinessException(
          'SERIE_NFE_INVALIDA',
          'Serie fiscal NF-e nao encontrada, inativa ou em ambiente divergente.',
          400,
          { serieFiscalId: dto.serieFiscalId, ambiente: dto.ambiente },
        );
      }
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const nota = await tx.notaFiscal.create({
          data: {
            tenantId,
            empresaId: dto.empresaId,
            serieFiscalId: dto.serieFiscalId ?? null,
            modelo: 'NFE_55',
            ambiente: dto.ambiente,
            serie: dto.serie,
            status: 'DRAFT',
            idempotencyKey: dto.idempotencyKey,
            payload: dto.payload as Prisma.InputJsonValue,
          },
        });
        await tx.notaFiscalEvento.create({
          data: {
            tenantId,
            notaFiscalId: nota.id,
            action: 'draft.create',
            status: 'DRAFT',
            mensagem: 'Rascunho NF-e criado para emissao direta SEFAZ-SC.',
          },
        });
        return tx.notaFiscal.findUniqueOrThrow({
          where: { id: nota.id },
          include: { eventos: { orderBy: { createdAt: 'desc' } } },
        });
      });
      return this.serialize(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new DuplicateException('idempotencyKey', dto.idempotencyKey);
      }
      throw err;
    }
  }

  async createNfseDraft(dto: NfseDraftCreateInput): Promise<unknown> {
    const tenantId = this.requireTenant();
    await this.assertEmpresaDoTenant(dto.empresaId, tenantId, 'NFS-e');
    await this.assertSerieFiscal({
      tenantId,
      serieFiscalId: dto.serieFiscalId,
      modelo: 'NFSE',
      serie: dto.serie,
      ambiente: dto.ambiente,
      label: 'NFS-e',
    });
    return this.createNotaDraft({
      tenantId,
      empresaId: dto.empresaId,
      serieFiscalId: dto.serieFiscalId,
      modelo: 'NFSE',
      ambiente: dto.ambiente,
      serie: dto.serie,
      idempotencyKey: dto.idempotencyKey,
      payload: {
        ...dto.payload,
        integracaoMunicipal: false,
        escopo: 'Base operacional NFS-e Santa Catarina sem transmissao municipal real.',
      },
      action: 'nfse.draft.create',
      mensagem: 'Rascunho NFS-e criado em modo operacional SC, sem transmissao municipal real.',
    });
  }

  async createDevolucaoDraft(dto: DevolucaoDraftCreateInput): Promise<unknown> {
    const tenantId = this.requireTenant();
    await this.assertEmpresaDoTenant(dto.empresaId, tenantId, 'devolucao');
    await this.assertSerieFiscal({
      tenantId,
      serieFiscalId: dto.serieFiscalId,
      modelo: 'NFE_55',
      serie: dto.serie,
      ambiente: dto.ambiente,
      label: 'NF-e de devolucao',
    });
    return this.createNotaDraft({
      tenantId,
      empresaId: dto.empresaId,
      serieFiscalId: dto.serieFiscalId,
      modelo: 'DEVOLUCAO',
      ambiente: dto.ambiente,
      serie: dto.serie,
      idempotencyKey: dto.idempotencyKey,
      payload: dto.payload,
      action: 'devolucao.draft.create',
      mensagem: 'Rascunho de nota de devolucao criado com referencia a NF-e de origem.',
    });
  }

  async authorizeInternal(id: string, modelo: 'NFSE' | 'DEVOLUCAO'): Promise<unknown> {
    const tenantId = this.requireTenant();
    const row = await this.prisma.notaFiscal.findFirst({ where: { id, tenantId, modelo } });
    if (!row) throw new NotFoundResourceException('nota_fiscal', id);
    if (!['DRAFT', 'REJECTED'].includes(row.status)) return this.findOne(id);
    const numero = await this.reserveNumberIfNeeded(row);
    const xml = this.internalXml(row, numero);
    const protocolo = `${modelo}-${Date.now()}`;
    const chaveAcesso =
      modelo === 'DEVOLUCAO' ? this.fakeDevolucaoAccessKey(row, numero) : undefined;
    const updated = await this.prisma.notaFiscal.update({
      where: { id },
      data: {
        numero,
        status: 'AUTHORIZED',
        chaveAcesso,
        protocoloAutorizacao: protocolo,
        autorizadaEm: new Date(),
        emitidaEm: row.emitidaEm ?? new Date(),
        payload: this.mergePayload(row.payload, {
          xmlAutorizado: xml,
          autorizacaoInterna: {
            protocolo,
            semTransmissaoExterna: true,
            ufBase: 'SC',
          },
        }),
        eventos: {
          create: {
            tenantId,
            action: modelo === 'NFSE' ? 'nfse.internal_authorized' : 'devolucao.internal_authorized',
            status: 'AUTHORIZED',
            codigo: 'SIMULADO',
            mensagem:
              modelo === 'NFSE'
                ? 'NFS-e preparada internamente para SC, sem transmissao municipal real.'
                : 'Nota de devolucao autorizada internamente para fluxo operacional.',
          },
        },
      },
      include: { eventos: { orderBy: { createdAt: 'desc' } } },
    });
    return this.serialize(updated);
  }

  async enqueueEmission(id: string): Promise<unknown> {
    await this.findOne(id);
    return this.queue.enqueueEmission(id);
  }

  async processEmissionNow(id: string): Promise<unknown> {
    await this.findOne(id);
    return this.emission.processEmission(id);
  }

  async cancel(id: string, dto: NfeCancelInput): Promise<unknown> {
    const tenantId = this.requireTenant();
    return this.emission.cancel(id, tenantId, dto);
  }

  async getXml(id: string): Promise<{ filename: string; content: string }> {
    const tenantId = this.requireTenant();
    const row = await this.prisma.notaFiscal.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundResourceException('nota_fiscal', id);
    let content: string | null = null;
    if (row.xmlAutorizadoS3Key) {
      try {
        content = (await this.s3.downloadFiscalDocument(tenantId, row.xmlAutorizadoS3Key)).toString(
          'utf8',
        );
      } catch {
        content = null;
      }
    }
    if (!content) {
      content = this.xmlFromPayload(row.payload);
    }
    if (!content) {
      throw new BusinessException(
        'FISCAL_XML_NOT_AVAILABLE',
        'XML do documento fiscal ainda nao esta disponivel.',
        404,
      );
    }
    return { filename: `${row.chaveAcesso ?? row.id}.xml`, content };
  }

  async getDanfe(id: string): Promise<{ filename: string; contentBase64: string }> {
    const tenantId = this.requireTenant();
    const row = await this.prisma.notaFiscal.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundResourceException('nota_fiscal', id);
    if (!['AUTHORIZED', 'CANCELLED'].includes(row.status)) {
      throw new BusinessException(
        'FISCAL_PDF_NOT_AVAILABLE',
        'PDF fica disponivel apos autorizacao do documento fiscal.',
        409,
        { status: row.status },
      );
    }
    const xml = await this.authorizedXmlForRow(row);
    const pdf = renderDanfePdfFromXml(row, xml);
    return {
      filename: `${this.documentPdfPrefix(row.modelo)}-${row.chaveAcesso ?? row.id}.pdf`,
      contentBase64: pdf.toString('base64'),
    };
  }

  private async assertEmpresaDoTenant(
    empresaId: string,
    tenantId: string,
    label: string,
  ): Promise<void> {
    if (empresaId !== tenantId) {
      throw new ForbiddenResourceException(`Nao e permitido emitir ${label} para outra empresa.`);
    }
  }

  private async assertSerieFiscal(params: {
    tenantId: string;
    serieFiscalId: string | undefined;
    modelo: 'NFE_55' | 'NFSE';
    serie: number;
    ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
    label: string;
  }): Promise<void> {
    if (!params.serieFiscalId) return;
    const serie = await this.prisma.serieFiscal.findFirst({
      where: {
        id: params.serieFiscalId,
        tenantId: params.tenantId,
        modelo: params.modelo,
        serie: params.serie,
        ambiente: params.ambiente,
        ativa: true,
      },
    });
    if (!serie) {
      throw new BusinessException(
        'SERIE_FISCAL_INVALIDA',
        `Serie fiscal ${params.label} nao encontrada, inativa ou em ambiente divergente.`,
        400,
        { serieFiscalId: params.serieFiscalId, ambiente: params.ambiente },
      );
    }
  }

  private async createNotaDraft(params: {
    tenantId: string;
    empresaId: string;
    serieFiscalId?: string;
    modelo: 'NFSE' | 'DEVOLUCAO';
    ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
    serie: number;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    action: string;
    mensagem: string;
  }): Promise<unknown> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const nota = await tx.notaFiscal.create({
          data: {
            tenantId: params.tenantId,
            empresaId: params.empresaId,
            serieFiscalId: params.serieFiscalId ?? null,
            modelo: params.modelo,
            ambiente: params.ambiente,
            serie: params.serie,
            status: 'DRAFT',
            idempotencyKey: params.idempotencyKey,
            payload: params.payload as Prisma.InputJsonValue,
          },
        });
        await tx.notaFiscalEvento.create({
          data: {
            tenantId: params.tenantId,
            notaFiscalId: nota.id,
            action: params.action,
            status: 'DRAFT',
            mensagem: params.mensagem,
          },
        });
        return tx.notaFiscal.findUniqueOrThrow({
          where: { id: nota.id },
          include: { eventos: { orderBy: { createdAt: 'desc' } } },
        });
      });
      return this.serialize(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new DuplicateException('idempotencyKey', params.idempotencyKey);
      }
      throw err;
    }
  }

  private async reserveNumberIfNeeded(
    row: Prisma.NotaFiscalGetPayload<true>,
  ): Promise<bigint | undefined> {
    if (row.numero) return row.numero;
    if (!row.serieFiscalId) return BigInt(Date.now() % 1_000_000);
    const serieFiscalId = row.serieFiscalId;
    return this.prisma.$transaction(async (tx) => {
      const serie = await tx.serieFiscal.findUnique({ where: { id: serieFiscalId } });
      if (!serie) return BigInt(Date.now() % 1_000_000);
      await tx.serieFiscal.update({
        where: { id: serieFiscalId },
        data: { proximoNumero: serie.proximoNumero + BigInt(1) },
      });
      return serie.proximoNumero;
    });
  }

  private requireTenant(): string {
    const tenantId = getCurrentTenant()?.tenantId ?? null;
    if (!tenantId) {
      throw new BusinessException('NO_TENANT', 'Empresa ativa requerida para NF-e.', 400);
    }
    return tenantId;
  }

  private serialize(row: NotaFiscalRow): Record<string, unknown> {
    return {
      id: row.id,
      empresaId: row.empresaId,
      serieFiscalId: row.serieFiscalId,
      modelo: row.modelo,
      ambiente: row.ambiente,
      serie: row.serie,
      numero: row.numero?.toString() ?? null,
      chaveAcesso: row.chaveAcesso,
      status: row.status,
      protocoloAutorizacao: row.protocoloAutorizacao,
      rejeicaoCodigo: row.rejeicaoCodigo,
      rejeicaoMensagem: row.rejeicaoMensagem,
      xmlDisponivel: Boolean(row.xmlAutorizadoS3Key || this.xmlFromPayload(row.payload)),
      danfeDisponivel: ['AUTHORIZED', 'CANCELLED'].includes(row.status),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      eventos: row.eventos.map((evento) => ({
        id: evento.id,
        action: evento.action,
        status: evento.status,
        codigo: evento.codigo,
        mensagem: evento.mensagem,
        createdAt: evento.createdAt.toISOString(),
      })),
    };
  }

  private xmlFromPayload(payload: Prisma.JsonValue): string | null {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    for (const key of ['xmlAutorizado', 'xmlAssinado', 'xml']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().startsWith('<')) return value;
    }
    return null;
  }

  private mergePayload(
    payload: Prisma.JsonValue,
    extra: Record<string, Prisma.JsonValue>,
  ): Prisma.InputJsonValue {
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      return { ...(payload as Record<string, Prisma.JsonValue>), ...extra };
    }
    return extra;
  }

  private internalXml(row: Prisma.NotaFiscalGetPayload<true>, numero: bigint | undefined): string {
    const root = row.modelo === 'NFSE' ? 'NfseOperacionalSC' : 'NFeDevolucaoOperacional';
    const escapedId = row.id.replace(/[<>&"]/g, '');
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<${root}>`,
      `  <Id>${escapedId}</Id>`,
      `  <Modelo>${row.modelo}</Modelo>`,
      `  <UFBase>SC</UFBase>`,
      `  <Ambiente>${row.ambiente}</Ambiente>`,
      `  <Serie>${row.serie}</Serie>`,
      `  <Numero>${numero?.toString() ?? ''}</Numero>`,
      '  <SemTransmissaoMunicipal>true</SemTransmissaoMunicipal>',
      `</${root}>`,
    ].join('\n');
  }

  private fakeDevolucaoAccessKey(row: Prisma.NotaFiscalGetPayload<true>, numero: bigint | undefined): string {
    const n = (numero?.toString() ?? '1').padStart(9, '0').slice(-9);
    return `4226041234567800019555001${n}1000000001`.slice(0, 44).padEnd(44, '0');
  }

  private documentPdfPrefix(modelo: string): string {
    if (modelo === 'NFSE') return 'DANFSE';
    if (modelo === 'DEVOLUCAO') return 'DEVOLUCAO';
    return 'DANFE';
  }

  private async authorizedXmlForRow(row: Prisma.NotaFiscalGetPayload<true>): Promise<string> {
    let content: string | null = null;
    if (row.xmlAutorizadoS3Key) {
      try {
        content = (await this.s3.downloadFiscalDocument(row.tenantId, row.xmlAutorizadoS3Key)).toString(
          'utf8',
        );
      } catch {
        content = null;
      }
    }
    content ??= this.xmlFromPayload(row.payload);
    if (!content) {
      throw new BusinessException(
        'FISCAL_XML_NOT_AVAILABLE',
        'DANFE requer XML autorizado do documento fiscal.',
        404,
      );
    }
    return content;
  }
}
