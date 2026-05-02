import { Injectable } from '@nestjs/common';
import type {
  PageResult,
  ProdutoCreateInput,
  ProdutoListQuery,
  ProdutoUpdateInput,
} from '@nexo/shared';
import { Prisma, type Produto } from '@prisma/client';
import { DuplicateException, NotFoundResourceException } from '../../common/business.exception';
import { parseSort } from '../../common/parse-sort';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
import { requireTenant } from '../../db/tenant-context';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { ProdutoFiscalValidationService } from './produto-fiscal-validation.service';

const SORTABLE_FIELDS = ['descricao', 'codigo', 'ncm', 'createdAt', 'updatedAt'] as const;

/**
 * ProdutosService — CRUD multi-tenant de Produto (Phase 2 Plan 02-02).
 *
 * Diferenças vs Cliente/Fornecedor:
 *  - Campo único é `codigo` (SKU interno), não cpfCnpj.
 *  - Filtros: ncm, categoria.
 *  - Sort default: descricao asc (UX — produto é encontrado por nome).
 *  - Decimals chegam como string (validados em schema Zod) e são repassados ao
 *    Prisma que converte para Decimal nativo.
 */
@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalValidation: ProdutoFiscalValidationService,
  ) {}

  async list(query: ProdutoListQuery): Promise<PageResult<unknown>> {
    const { tenantId } = requireTenant();
    if (!tenantId) {
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
    }

    const where: Prisma.ProdutoWhereInput = { tenantId };
    if (query.search) {
      where.OR = [
        { descricao: { contains: query.search, mode: 'insensitive' } },
        { codigo: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.ncm) where.ncm = query.ncm;
    if (query.categoria) where.categoria = query.categoria;
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';

    const orderBy = parseSort(query.sort, {
      allowed: SORTABLE_FIELDS,
      default: { descricao: 'asc' },
    });

    const [items, total] = await Promise.all([
      this.prisma.produto.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.produto.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string): Promise<Produto> {
    const { tenantId } = requireTenant();
    const row = await this.prisma.produto.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!row) throw new NotFoundResourceException('produto', id);
    return row;
  }

  async create(dto: ProdutoCreateInput): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) throw new NotFoundResourceException('produto', 'no_tenant_context');

    await this.fiscalValidation.validate({ ncm: dto.ncm, cest: dto.cest });

    try {
      return await this.prisma.produto.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          descricao: dto.descricao,
          ncm: dto.ncm,
          cest: dto.cest ?? null,
          cfopPadrao: dto.cfopPadrao ?? null,
          cstIcms: dto.cstIcms ?? null,
          csosn: dto.csosn ?? null,
          origemMercadoria: dto.origemMercadoria,
          unidade: dto.unidade,
          peso: dto.peso ?? null,
          categoria: dto.categoria ?? null,
          precoCusto: dto.precoCusto ?? null,
          margem: dto.margem ?? null,
          precoVenda: dto.precoVenda,
          aliquotaIcms: dto.aliquotaIcms ?? null,
          aliquotaIpi: dto.aliquotaIpi ?? null,
          aliquotaPis: dto.aliquotaPis ?? null,
          aliquotaCofins: dto.aliquotaCofins ?? null,
          estoqueInicial: dto.estoqueInicial ?? null,
          estoqueMinimo: dto.estoqueMinimo ?? null,
          estoqueMaximo: dto.estoqueMaximo ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('codigo', dto.codigo);
      }
      throw err;
    }
  }

  async update(id: string, dto: ProdutoUpdateInput): Promise<unknown> {
    const current = await this.findOne(id);
    await this.fiscalValidation.validate({
      ncm: dto.ncm ?? current.ncm,
      cest: dto.cest !== undefined ? dto.cest : current.cest,
    });

    try {
      const data: Prisma.ProdutoUpdateInput = {};
      // Apenas campos presentes no DTO são repassados (PATCH semantics).
      const fields: Array<keyof ProdutoUpdateInput> = [
        'codigo',
        'descricao',
        'ncm',
        'cest',
        'cfopPadrao',
        'cstIcms',
        'csosn',
        'origemMercadoria',
        'unidade',
        'peso',
        'categoria',
        'precoCusto',
        'margem',
        'precoVenda',
        'aliquotaIcms',
        'aliquotaIpi',
        'aliquotaPis',
        'aliquotaCofins',
        'estoqueInicial',
        'estoqueMinimo',
        'estoqueMaximo',
        'ativo',
      ];
      for (const f of fields) {
        if (dto[f] !== undefined) {
          // biome-ignore lint/suspicious/noExplicitAny: typed via fields[] whitelist
          (data as any)[f] = dto[f];
        }
      }
      return await this.prisma.produto.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('codigo', dto.codigo ?? '');
      }
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.produto.update({ where: { id }, data: { ativo: false } });
  }
}
