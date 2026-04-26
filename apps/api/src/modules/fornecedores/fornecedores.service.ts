import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  FornecedorCreateInput,
  FornecedorListQuery,
  FornecedorUpdateInput,
  PageResult,
} from '@nexo/shared';
import {
  DuplicateException,
  NotFoundResourceException,
} from '../../common/business.exception';
import { parseSort } from '../../common/parse-sort';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
import { requireTenant } from '../../db/tenant-context';

const SORTABLE_FIELDS = ['razaoSocial', 'cpfCnpj', 'createdAt', 'updatedAt'] as const;

/**
 * FornecedoresService — CRUD multi-tenant de Fornecedor (Phase 2 Plan 02-02).
 * Estrutura idêntica a ClientesService; differs apenas no campo de busca
 * (razaoSocial em vez de nome) e ausência de tipoPessoa.
 */
@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: FornecedorListQuery): Promise<PageResult<unknown>> {
    const { tenantId } = requireTenant();
    if (!tenantId) {
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
    }

    const where: Prisma.FornecedorWhereInput = { tenantId };
    if (query.search) {
      const digits = query.search.replace(/\D/g, '');
      where.OR = [
        { razaoSocial: { contains: query.search, mode: 'insensitive' } },
        { nomeFantasia: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ cpfCnpj: { contains: digits } }] : []),
      ];
    }
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';

    const orderBy = parseSort(query.sort, {
      allowed: SORTABLE_FIELDS,
      default: { createdAt: 'desc' },
    });

    const [items, total] = await Promise.all([
      this.prisma.fornecedor.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.fornecedor.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string): Promise<unknown> {
    const { tenantId } = requireTenant();
    const row = await this.prisma.fornecedor.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!row) throw new NotFoundResourceException('fornecedor', id);
    return row;
  }

  async create(dto: FornecedorCreateInput): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) throw new NotFoundResourceException('fornecedor', 'no_tenant_context');

    try {
      return await this.prisma.fornecedor.create({
        data: {
          tenantId,
          cpfCnpj: dto.cpfCnpj,
          razaoSocial: dto.razaoSocial,
          nomeFantasia: dto.nomeFantasia ?? null,
          inscricaoEst: dto.inscricaoEst ?? null,
          endereco: dto.endereco as Prisma.InputJsonValue,
          email: dto.email ?? null,
          telefone: dto.telefone ?? null,
          contatoComercial: dto.contatoComercial ?? null,
          condicoesPadrao: dto.condicoesPadrao
            ? (dto.condicoesPadrao as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cpfCnpj', dto.cpfCnpj);
      }
      throw err;
    }
  }

  async update(id: string, dto: FornecedorUpdateInput): Promise<unknown> {
    await this.findOne(id);
    try {
      const data: Prisma.FornecedorUpdateInput = {};
      if (dto.cpfCnpj !== undefined) data.cpfCnpj = dto.cpfCnpj;
      if (dto.razaoSocial !== undefined) data.razaoSocial = dto.razaoSocial;
      if (dto.nomeFantasia !== undefined) data.nomeFantasia = dto.nomeFantasia;
      if (dto.inscricaoEst !== undefined) data.inscricaoEst = dto.inscricaoEst;
      if (dto.endereco !== undefined) data.endereco = dto.endereco as Prisma.InputJsonValue;
      if (dto.email !== undefined) data.email = dto.email;
      if (dto.telefone !== undefined) data.telefone = dto.telefone;
      if (dto.contatoComercial !== undefined) data.contatoComercial = dto.contatoComercial;
      if (dto.condicoesPadrao !== undefined) {
        data.condicoesPadrao = dto.condicoesPadrao
          ? (dto.condicoesPadrao as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      }
      if (dto.ativo !== undefined) data.ativo = dto.ativo;

      return await this.prisma.fornecedor.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cpfCnpj', dto.cpfCnpj ?? '');
      }
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
  }

  /**
   * findByCpfCnpj — verificação de duplicidade por tenant (Plan 02-03 / CAD-09).
   *
   * Mesmo padrão do ClientesService: sem tenant ativo retorna null (T-02-03-07).
   */
  async findByCpfCnpj(cpfCnpj: string): Promise<{ id: string; razaoSocial: string } | null> {
    const { tenantId } = requireTenant();
    if (!tenantId) return null;
    return this.prisma.fornecedor.findUnique({
      where: { tenantId_cpfCnpj: { tenantId, cpfCnpj } },
      select: { id: true, razaoSocial: true },
    });
  }
}
