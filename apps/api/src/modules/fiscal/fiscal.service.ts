import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NfeCancelInput, NfeDraftCreateInput } from '@nexo/shared';
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
    const tenantId = this.requireTenant();
    const rows = await this.prisma.notaFiscal.findMany({
      where: { tenantId, modelo: 'NFE_55' },
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
        'NFE_XML_NOT_AVAILABLE',
        'XML da NF-e ainda nao esta disponivel.',
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
        'DANFE_NOT_AVAILABLE',
        'DANFE fica disponivel apos autorizacao da NF-e.',
        409,
        { status: row.status },
      );
    }
    const pdf = this.simpleDanfePdf(row);
    return {
      filename: `DANFE-${row.chaveAcesso ?? row.id}.pdf`,
      contentBase64: pdf.toString('base64'),
    };
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

  private simpleDanfePdf(row: Prisma.NotaFiscalGetPayload<true>): Buffer {
    const lines = [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ];
    const text = [
      'DANFE - Documento Auxiliar da NF-e',
      `Modelo: ${row.modelo}  Serie: ${row.serie}  Numero: ${row.numero?.toString() ?? '-'}`,
      `Status: ${row.status}`,
      `Chave: ${row.chaveAcesso ?? '-'}`,
      `Protocolo: ${row.protocoloAutorizacao ?? '-'}`,
      'Representacao visual gerada a partir dos dados da NF-e.',
    ];
    const stream = `BT /F1 14 Tf 40 790 Td ${text
      .map((line, index) => `${index === 0 ? '' : '0 -24 Td '}(${line.replace(/[()]/g, '')}) Tj`)
      .join(' ')} ET`;
    lines.push(`4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream`);
    lines.push(stream);
    lines.push('endstream endobj');
    lines.push('xref 0 6');
    lines.push('0000000000 65535 f ');
    lines.push('trailer << /Root 1 0 R /Size 6 >>');
    lines.push('startxref');
    lines.push('0');
    lines.push('%%EOF');
    return Buffer.from(lines.join('\n'), 'latin1');
  }
}
