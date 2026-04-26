import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SerieAmbiente, SerieCreateInput, SerieUpdateInput } from '@nexo/shared';
import {
  BusinessException,
  DuplicateException,
  ForbiddenResourceException,
  NotFoundResourceException,
} from '../../common/business.exception';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
import { getCurrentTenant } from '../../db/tenant-context';

type SerieRow = Prisma.SerieFiscalGetPayload<true>;

/**
 * SeriesService — CRUD multi-tenant de SerieFiscal (Phase 2 Plan 02-06).
 *
 * Endpoints sob /api/series. Phase 3 (emissão) usa:
 *  - `assertEnvironmentMatch(serie, requestedEnv)` para guard CERT-08.
 *  - `SeriesNumberingHelper.getNextSeqAndIncrement` para numeração atômica.
 *
 * Defesas:
 *  - WHERE tenantId redundante além de RLS (defense in depth — Plan 02-02).
 *  - empresaId no body é validado contra requireTenant().tenantId — não pode
 *    criar série para outra empresa (T-02-06-03).
 *  - DELETE = soft (ativa=false). Séries persistem para audit/histórico fiscal.
 *  - P2002 → DuplicateException (constraint @@unique([empresaId, modelo, serie])).
 *  - Mudança de ambiente HOMOLOGACAO↔PRODUCAO sempre auditada (controller).
 */
@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<unknown[]> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    if (!tenantId) return [];
    const rows = await this.prisma.serieFiscal.findMany({
      where: { tenantId },
      orderBy: [{ modelo: 'asc' }, { serie: 'asc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  async findOne(id: string): Promise<unknown> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    const row = await this.prisma.serieFiscal.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!row) throw new NotFoundResourceException('serie', id);
    return this.serialize(row);
  }

  async create(dto: SerieCreateInput): Promise<unknown> {
    const scope = getCurrentTenant();
    const tenantId = scope?.tenantId ?? null;
    if (!tenantId) {
      throw new BusinessException(
        'NO_TENANT',
        'Empresa ativa requerida para criar série fiscal',
        400,
      );
    }
    // T-02-06-03 — não permitir criar série para outra empresa via body.
    if (dto.empresaId !== tenantId) {
      throw new ForbiddenResourceException(
        'Não é permitido criar série para outra empresa.',
      );
    }

    try {
      const row = await this.prisma.serieFiscal.create({
        data: {
          tenantId,
          empresaId: dto.empresaId,
          modelo: dto.modelo,
          serie: dto.serie,
          proximoNumero: BigInt(dto.proximoNumero),
          ambiente: dto.ambiente,
          ativa: true,
        },
      });
      return this.serialize(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new DuplicateException(
          'serie',
          `${dto.modelo}-${dto.serie}`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: SerieUpdateInput): Promise<unknown> {
    // findOne aplica filtro por tenant — 404 se for de outro tenant.
    await this.findOne(id);
    const data: Prisma.SerieFiscalUpdateInput = {};
    if (dto.ambiente !== undefined) data.ambiente = dto.ambiente;
    if (dto.ativa !== undefined) data.ativa = dto.ativa;
    const row = await this.prisma.serieFiscal.update({
      where: { id },
      data,
    });
    return this.serialize(row);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    // Soft delete via ativa=false. Séries são imutáveis após uso fiscal —
    // helper getNextSeqAndIncrement bloqueia consumo subsequente
    // (T-02-06-06). A linha persiste para audit/histórico.
    await this.prisma.serieFiscal.update({
      where: { id },
      data: { ativa: false },
    });
  }

  /**
   * Helper exportado para Phase 3 emissão (CERT-08).
   *
   * Lança ENV_MISMATCH 403 se o ambiente da série não bate com o ambiente
   * solicitado pela emissão. Defesa de segurança server-side: o banner amarelo
   * é defesa de UX; este guard é defesa de execução.
   */
  assertEnvironmentMatch(
    serie: { ambiente: string },
    requestedEnv: SerieAmbiente,
  ): void {
    if (serie.ambiente !== requestedEnv) {
      throw new BusinessException(
        'ENV_MISMATCH',
        `Série está em ${serie.ambiente}; emissão pediu ${requestedEnv}.`,
        403,
        { serieAmbiente: serie.ambiente, requestedEnv },
      );
    }
  }

  /**
   * Resposta JSON-safe — converte BigInt e Date para string.
   * NUNCA inclua tenantId no payload (vaza identificador interno; FE não
   * precisa — sempre opera no tenant ativo via header x-tenant-id).
   */
  private serialize(row: SerieRow): Record<string, unknown> {
    return {
      id: row.id,
      empresaId: row.empresaId,
      modelo: row.modelo,
      serie: row.serie,
      proximoNumero: row.proximoNumero.toString(),
      ambiente: row.ambiente,
      ativa: row.ativa,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
