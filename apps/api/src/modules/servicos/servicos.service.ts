import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PageResult,
  ServicoCreateInput,
  ServicoListQuery,
  ServicoUpdateInput,
} from '@nexo/shared';
import {
  DuplicateException,
  NotFoundResourceException,
} from '../../common/business.exception';
import { parseSort } from '../../common/parse-sort';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
import { requireTenant } from '../../db/tenant-context';

const SORTABLE_FIELDS = [
  'descricao',
  'codigoInterno',
  'codigoMunicipal',
  'createdAt',
  'updatedAt',
] as const;

/**
 * ServicosService — CRUD multi-tenant de Servico (Phase 2 Plan 02-02).
 *
 * Diferenças vs Produto:
 *  - Campo único é `codigoInterno`.
 *  - Filtro por `codigoMunicipal` (LC 116/2003).
 *  - precoPadrao + aliquotaIss obrigatórios (regra NFS-e).
 */
@Injectable()
export class ServicosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ServicoListQuery): Promise<PageResult<unknown>> {
    const { tenantId } = requireTenant();
    if (!tenantId) {
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
    }

    const where: Prisma.ServicoWhereInput = { tenantId };
    if (query.search) {
      where.OR = [
        { descricao: { contains: query.search, mode: 'insensitive' } },
        { codigoInterno: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.codigoMunicipal) where.codigoMunicipal = query.codigoMunicipal;
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';

    const orderBy = parseSort(query.sort, {
      allowed: SORTABLE_FIELDS,
      default: { descricao: 'asc' },
    });

    const [items, total] = await Promise.all([
      this.prisma.servico.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.servico.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string): Promise<unknown> {
    const { tenantId } = requireTenant();
    const row = await this.prisma.servico.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!row) throw new NotFoundResourceException('servico', id);
    return row;
  }

  async create(dto: ServicoCreateInput): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) throw new NotFoundResourceException('servico', 'no_tenant_context');

    try {
      return await this.prisma.servico.create({
        data: {
          tenantId,
          codigoInterno: dto.codigoInterno,
          descricao: dto.descricao,
          codigoMunicipal: dto.codigoMunicipal,
          cnae: dto.cnae ?? null,
          precoPadrao: dto.precoPadrao,
          aliquotaIss: dto.aliquotaIss,
          retencaoIr: dto.retencaoIr ?? null,
          retencaoInss: dto.retencaoInss ?? null,
          retencaoPis: dto.retencaoPis ?? null,
          retencaoCofins: dto.retencaoCofins ?? null,
          retencaoCsll: dto.retencaoCsll ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('codigoInterno', dto.codigoInterno);
      }
      throw err;
    }
  }

  async update(id: string, dto: ServicoUpdateInput): Promise<unknown> {
    await this.findOne(id);
    try {
      const data: Prisma.ServicoUpdateInput = {};
      const fields: Array<keyof ServicoUpdateInput> = [
        'codigoInterno',
        'descricao',
        'codigoMunicipal',
        'cnae',
        'precoPadrao',
        'aliquotaIss',
        'retencaoIr',
        'retencaoInss',
        'retencaoPis',
        'retencaoCofins',
        'retencaoCsll',
        'ativo',
      ];
      for (const f of fields) {
        if (dto[f] !== undefined) {
          // biome-ignore lint/suspicious/noExplicitAny: typed via fields[] whitelist
          (data as any)[f] = dto[f];
        }
      }
      return await this.prisma.servico.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('codigoInterno', dto.codigoInterno ?? '');
      }
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.servico.update({ where: { id }, data: { ativo: false } });
  }
}
