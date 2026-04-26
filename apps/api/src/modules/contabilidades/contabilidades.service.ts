import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ContabilidadeCreateInput,
  ContabilidadeListQuery,
  ContabilidadeUpdateInput,
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

const SORTABLE_FIELDS = ['nome', 'cnpj', 'createdAt', 'updatedAt'] as const;

/**
 * ContabilidadesService — CRUD de Contabilidade (Phase 2 Plan 02-02).
 *
 * Diferenças vs Cliente/Fornecedor/Empresa:
 *  - Contabilidade NÃO tem tenant_id — é top-level (escritório contábil que
 *    administra várias empresas-tenant). Não há WHERE { tenantId } na query.
 *  - cnpj é UNIQUE GLOBAL.
 *  - clerkOrgId é managed by webhook svix (Plan 02-09) — NUNCA aceitar do cliente.
 *  - RBAC: apenas platform_admin (role 'admin') e contabilidade_owner via HTTP guard
 *    (controller). Service é defesa em profundidade — limita por contabilidadeId
 *    quando o user não é admin (vê apenas a própria contabilidade).
 *  - Schema atual NÃO tem colunas endereco/contatos — Zod aceita mas service
 *    descarta esses campos até migration adicionar (sem dataloss visível, validação
 *    do shape ainda é útil pro frontend).
 */
@Injectable()
export class ContabilidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ContabilidadeListQuery): Promise<PageResult<unknown>> {
    const { contabilidadeId, role } = requireTenant();

    // platform_admin lista todas; demais roles veem apenas a própria contabilidade.
    const where: Prisma.ContabilidadeWhereInput = {};
    if (role !== 'platform_admin') {
      if (!contabilidadeId) {
        return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
      }
      where.id = contabilidadeId;
    }

    if (query.search) {
      const digits = query.search.replace(/\D/g, '');
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ cnpj: { contains: digits } }] : []),
      ];
    }

    const orderBy = parseSort(query.sort, {
      allowed: SORTABLE_FIELDS,
      default: { nome: 'asc' },
    });

    const [items, total] = await Promise.all([
      this.prisma.contabilidade.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.contabilidade.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string): Promise<unknown> {
    const { contabilidadeId, role } = requireTenant();
    // Defesa em profundidade: non-admin só vê a própria contabilidade.
    if (role !== 'platform_admin' && contabilidadeId !== id) {
      throw new NotFoundResourceException('contabilidade', id);
    }
    const row = await this.prisma.contabilidade.findUnique({ where: { id } });
    if (!row) throw new NotFoundResourceException('contabilidade', id);
    return row;
  }

  async create(dto: ContabilidadeCreateInput): Promise<unknown> {
    try {
      // NOTA: endereco/contatos do DTO são descartados — schema atual não tem essas
      // colunas. Migration futura adiciona; por ora aceitar para compat de frontend.
      return await this.prisma.contabilidade.create({
        data: {
          nome: dto.nome,
          cnpj: dto.cnpj,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cnpj', dto.cnpj);
      }
      throw err;
    }
  }

  async update(id: string, dto: ContabilidadeUpdateInput): Promise<unknown> {
    await this.findOne(id); // 404 se não existe ou não pertence ao user
    try {
      const data: Prisma.ContabilidadeUpdateInput = {};
      if (dto.nome !== undefined) data.nome = dto.nome;
      if (dto.cnpj !== undefined) data.cnpj = dto.cnpj;
      // endereco/contatos descartados (idem create)
      return await this.prisma.contabilidade.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cnpj', dto.cnpj ?? '');
      }
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    // NOTA: Contabilidade no schema atual NÃO tem coluna `ativo` — soft delete não
    // é implementável sem migration. Por consistência com plan, retornamos sem
    // efeito visível em DB. Quando schema for estendido com `ativo Boolean`, este
    // método deve ser atualizado para `update({ data: { ativo: false } })`.
    // Por ora: lançamos erro explícito para evitar falsa sensação de delete.
    throw new NotFoundResourceException(
      'contabilidade.softDelete',
      'soft_delete_indisponivel_ate_migration_adicionar_coluna_ativo',
    );
  }
}
