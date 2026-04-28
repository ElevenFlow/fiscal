import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NfeCancelInput } from '@nexo/shared';
import { BusinessException } from '../../common/business.exception';
import { PrismaService } from '../../db/prisma.service';
import { SeriesNumberingHelper } from '../series/series-numbering.helper';
import { S3Service } from '../storage/s3.service';
import { FISCAL_GATEWAY, type FiscalGateway } from './fiscal.gateway';
import { NfeXmlBuilderService } from './xml/nfe-xml.builder';

type NotaFiscalWithEventos = Prisma.NotaFiscalGetPayload<{ include: { eventos: true } }>;

@Injectable()
export class FiscalEmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: SeriesNumberingHelper,
    private readonly s3: S3Service,
    private readonly xmlBuilder: NfeXmlBuilderService,
    @Inject(FISCAL_GATEWAY) private readonly gateway: FiscalGateway,
  ) {}

  async processEmission(notaFiscalId: string): Promise<unknown> {
    const nota = await this.prisma.notaFiscal.findUnique({
      where: { id: notaFiscalId },
    });
    if (!nota) {
      throw new BusinessException('NFE_NOT_FOUND', 'NF-e nao encontrada.', 404, {
        notaFiscalId,
      });
    }
    if (!['DRAFT', 'REJECTED', 'PENDING_RESPONSE'].includes(nota.status)) {
      return this.load(nota.id);
    }

    if (nota.status === 'PENDING_RESPONSE' && nota.chaveAcesso) {
      const consulta = await this.gateway.consultarProtocolo({
        tenantId: nota.tenantId,
        ambiente: nota.ambiente as 'HOMOLOGACAO' | 'PRODUCAO',
        chaveAcesso: nota.chaveAcesso,
      });
      if (consulta.status === 'AUTHORIZED') {
        await this.markAuthorized(nota.id, nota.tenantId, consulta);
      }
      return this.load(nota.id);
    }

    const prepared = await this.prepareForTransmission(nota);
    const xmlAssinado = this.getSignedXmlFromPayload(prepared.payload);
    if (!xmlAssinado) {
      await this.transition(
        prepared.id,
        prepared.tenantId,
        'REJECTED',
        'signing.missing_xml',
        'XML assinado ainda nao disponivel. Subfase 03.2 criou a assinatura; 03.3 exige payload assinado ou worker com senha A1.',
        { code: 'SIGNED_XML_MISSING' },
      );
      return this.load(prepared.id);
    }

    await this.transition(
      prepared.id,
      prepared.tenantId,
      'TRANSMITTING',
      'sefaz.transmit.start',
      'Transmitindo NF-e para SEFAZ-SC/SVRS.',
    );

    const result = await this.gateway.autorizar({
      notaFiscalId: prepared.id,
      tenantId: prepared.tenantId,
      ambiente: prepared.ambiente as 'HOMOLOGACAO' | 'PRODUCAO',
      xmlAssinado,
    });

    if (result.status === 'AUTHORIZED') {
      await this.markAuthorized(prepared.id, prepared.tenantId, result);
    } else if (result.status === 'PENDING_RESPONSE') {
      await this.transition(
        prepared.id,
        prepared.tenantId,
        'PENDING_RESPONSE',
        'sefaz.pending',
        result.mensagem ?? 'SEFAZ retornou processamento pendente.',
        { code: result.codigo, recibo: result.recibo },
      );
    } else {
      await this.prisma.notaFiscal.update({
        where: { id: prepared.id },
        data: {
          status: 'REJECTED',
          rejeicaoCodigo: result.codigo ?? null,
          rejeicaoMensagem: result.mensagem ?? null,
          eventos: {
            create: {
              tenantId: prepared.tenantId,
              action: 'sefaz.rejected',
              status: 'REJECTED',
              codigo: result.codigo,
              mensagem: result.mensagem,
            },
          },
        },
      });
    }

    return this.load(prepared.id);
  }

  async cancel(notaFiscalId: string, tenantId: string, dto: NfeCancelInput): Promise<unknown> {
    const nota = await this.prisma.notaFiscal.findFirst({
      where: { id: notaFiscalId, tenantId },
    });
    if (!nota) {
      throw new BusinessException('NFE_NOT_FOUND', 'NF-e nao encontrada.', 404, {
        notaFiscalId,
      });
    }
    if (nota.status !== 'AUTHORIZED' || !nota.chaveAcesso) {
      throw new BusinessException(
        'NFE_CANCEL_INVALID_STATE',
        'Apenas NF-e autorizada pode ser cancelada.',
        409,
        { status: nota.status },
      );
    }
    const result = await this.gateway.cancelar({
      tenantId,
      ambiente: nota.ambiente as 'HOMOLOGACAO' | 'PRODUCAO',
      chaveAcesso: nota.chaveAcesso,
      justificativa: dto.justificativa,
    });
    await this.prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: result.status,
        cancelamentoProtocolo: result.protocolo ?? null,
        canceladaEm: result.status === 'CANCELLED' ? new Date() : null,
        eventos: {
          create: {
            tenantId,
            action: 'sefaz.cancel',
            status: result.status,
            codigo: result.codigo,
            mensagem: result.mensagem,
          },
        },
      },
    });
    return this.load(nota.id);
  }

  private async prepareForTransmission(
    nota: Prisma.NotaFiscalGetPayload<true>,
  ): Promise<Prisma.NotaFiscalGetPayload<true>> {
    if (!nota.serieFiscalId) {
      throw new BusinessException(
        'NFE_SERIE_REQUIRED',
        'Serie fiscal obrigatoria para transmitir NF-e.',
        400,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.notaFiscal.findUniqueOrThrow({
        where: { id: nota.id },
      });
      const numero =
        current.numero ??
        (await this.numbering.getNextSeqAndIncrement(nota.serieFiscalId as string, tx));
      const updated = await tx.notaFiscal.update({
        where: { id: nota.id },
        data: {
          numero,
          status: 'SIGNING',
          emitidaEm: current.emitidaEm ?? new Date(),
          eventos: {
            create: {
              tenantId: nota.tenantId,
              action: 'signing.start',
              status: 'SIGNING',
              mensagem: 'Numero fiscal reservado e NF-e preparada para assinatura.',
            },
          },
        },
      });
      return updated;
    });
  }

  private getSignedXmlFromPayload(payload: Prisma.JsonValue): string | null {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return null;
    }
    const value = (payload as Record<string, unknown>).xmlAssinado;
    if (typeof value === 'string' && value.includes('<Signature')) return value;
    const xmlInput = (payload as Record<string, unknown>).nfeXml;
    if (typeof xmlInput === 'object' && xmlInput !== null && !Array.isArray(xmlInput)) {
      try {
        return this.xmlBuilder.build(xmlInput as never);
      } catch {
        return null;
      }
    }
    return null;
  }

  private async markAuthorized(
    notaFiscalId: string,
    tenantId: string,
    result: {
      chaveAcesso?: string;
      protocolo?: string;
      codigo?: string;
      mensagem?: string;
      xmlAutorizado?: string;
    },
  ): Promise<void> {
    let xmlAutorizadoS3Key: string | undefined;
    const chaveAcesso = result.chaveAcesso;
    if (result.xmlAutorizado && chaveAcesso) {
      try {
        const uploaded = await this.s3.uploadFiscalDocument({
          tenantId,
          kind: 'nfe_autorizada',
          chaveAcesso,
          bytes: Buffer.from(result.xmlAutorizado, 'utf8'),
          contentType: 'application/xml; charset=utf-8',
        });
        xmlAutorizadoS3Key = uploaded.key;
      } catch {
        xmlAutorizadoS3Key = undefined;
      }
    }

    const current = await this.prisma.notaFiscal.findUnique({
      where: { id: notaFiscalId },
      select: { payload: true },
    });

    await this.prisma.notaFiscal.update({
      where: { id: notaFiscalId },
      data: {
        status: 'AUTHORIZED',
        chaveAcesso: chaveAcesso ?? undefined,
        protocoloAutorizacao: result.protocolo ?? undefined,
        xmlAutorizadoS3Key,
        payload: this.mergePayloadXml(current?.payload, result.xmlAutorizado),
        autorizadaEm: new Date(),
        eventos: {
          create: {
            tenantId,
            action: 'sefaz.authorized',
            status: 'AUTHORIZED',
            codigo: result.codigo,
            mensagem: result.mensagem,
          },
        },
      },
    });
  }

  private mergePayloadXml(
    payload: Prisma.JsonValue | undefined,
    xmlAutorizado: string | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (!xmlAutorizado) return undefined;
    if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
      return { ...(payload as Record<string, Prisma.JsonValue>), xmlAutorizado };
    }
    return { xmlAutorizado };
  }

  private async transition(
    notaFiscalId: string,
    tenantId: string,
    status: string,
    action: string,
    mensagem: string,
    payload?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.notaFiscal.update({
      where: { id: notaFiscalId },
      data: {
        status,
        eventos: {
          create: {
            tenantId,
            action,
            status,
            mensagem,
            payload,
          },
        },
      },
    });
  }

  private async load(id: string): Promise<NotaFiscalWithEventos> {
    return this.prisma.notaFiscal.findUniqueOrThrow({
      where: { id },
      include: { eventos: { orderBy: { createdAt: 'desc' } } },
    });
  }
}
