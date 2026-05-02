import { Injectable } from '@nestjs/common';
import type {
  EmpresaCreateInput,
  EmpresaListQuery,
  EmpresaUpdateInput,
  PageResult,
} from '@nexo/shared';
import { Prisma } from '@prisma/client';
import { DuplicateException, NotFoundResourceException } from '../../common/business.exception';
import { parseSort } from '../../common/parse-sort';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';
import { requireTenant } from '../../db/tenant-context';
import { withTenantContext } from '../../db/with-tenant';

const SORTABLE_FIELDS = ['razaoSocial', 'cnpj', 'createdAt', 'updatedAt'] as const;

/**
 * EmpresasService - CRUD de Empresa (tenant).
 *
 * Empresa cria o proprio tenant, entao create roda em contexto platform_admin
 * controlado e, quando possivel, vincula a nova empresa a contabilidade do usuario.
 */
@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: EmpresaListQuery): Promise<PageResult<unknown>> {
    const { tenantId, role } = requireTenant();

    const where: Prisma.EmpresaWhereInput = {};
    if (role !== 'platform_admin') {
      if (!tenantId) {
        return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
      }
      where.tenantId = tenantId;
    }

    if (query.search) {
      const digits = query.search.replace(/\D/g, '');
      where.OR = [
        { razaoSocial: { contains: query.search, mode: 'insensitive' } },
        { nomeFantasia: { contains: query.search, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ cnpj: { contains: digits } }] : []),
      ];
    }
    if (query.regimeTributario) where.regimeTributario = query.regimeTributario;
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';

    const orderBy = parseSort(query.sort, {
      allowed: SORTABLE_FIELDS,
      default: { razaoSocial: 'asc' },
    });

    const [items, total] = await Promise.all([
      this.prisma.empresa.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.empresa.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string): Promise<unknown> {
    const { tenantId, role } = requireTenant();
    const where: Prisma.EmpresaWhereInput =
      role === 'platform_admin' || !tenantId ? { id } : { id, tenantId };
    const row = await this.prisma.empresa.findFirst({ where });
    if (!row) throw new NotFoundResourceException('empresa', id);
    return row;
  }

  async create(dto: EmpresaCreateInput): Promise<unknown> {
    const { userId } = requireTenant();

    try {
      return await withTenantContext(
        this.prisma,
        { tenantId: null, role: 'platform_admin', userId },
        async (tx) => {
          const created = await tx.empresa.create({
            data: {
              razaoSocial: dto.razaoSocial,
              nomeFantasia: dto.nomeFantasia ?? null,
              cnpj: dto.cnpj,
              ie: dto.ie ?? null,
              im: dto.im ?? null,
              cnae: dto.cnae ?? null,
              regimeTributario: dto.regimeTributario,
              endereco: dto.endereco ? (dto.endereco as Prisma.InputJsonValue) : Prisma.JsonNull,
              contatos: dto.contatos ? (dto.contatos as Prisma.InputJsonValue) : Prisma.JsonNull,
              // Prisma exige UUID antes do trigger; o banco sobrescreve para id.
              tenantId: '00000000-0000-0000-0000-000000000000',
            },
          });

          const contabilidadeId =
            dto.contabilidadeId ?? (await this.firstContabilidadeMembership(tx, userId));
          if (contabilidadeId) {
            await tx.contabilidadeEmpresa.create({
              data: {
                contabilidadeId,
                empresaId: created.id,
              },
            });
          }

          return created;
        },
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cnpj', dto.cnpj);
      }
      throw err;
    }
  }

  async update(id: string, dto: EmpresaUpdateInput): Promise<unknown> {
    await this.findOne(id);
    try {
      const data: Prisma.EmpresaUpdateInput = {};
      if (dto.razaoSocial !== undefined) data.razaoSocial = dto.razaoSocial;
      if (dto.nomeFantasia !== undefined) data.nomeFantasia = dto.nomeFantasia;
      if (dto.cnpj !== undefined) data.cnpj = dto.cnpj;
      if (dto.ie !== undefined) data.ie = dto.ie;
      if (dto.im !== undefined) data.im = dto.im;
      if (dto.cnae !== undefined) data.cnae = dto.cnae;
      if (dto.regimeTributario !== undefined) data.regimeTributario = dto.regimeTributario;
      if (dto.endereco !== undefined) {
        data.endereco = dto.endereco ? (dto.endereco as Prisma.InputJsonValue) : Prisma.JsonNull;
      }
      if (dto.contatos !== undefined) {
        data.contatos = dto.contatos ? (dto.contatos as Prisma.InputJsonValue) : Prisma.JsonNull;
      }
      if (dto.ativo !== undefined) data.ativo = dto.ativo;

      return await this.prisma.empresa.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cnpj', dto.cnpj ?? '');
      }
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.empresa.update({ where: { id }, data: { ativo: false } });
  }

  async findMinhas(): Promise<unknown[]> {
    const { contabilidadeId, role, userId } = requireTenant();

    return withTenantContext(
      this.prisma,
      { tenantId: null, role: 'platform_admin' },
      async (tx) => {
        if (role === 'platform_admin') {
          return tx.empresa.findMany({
            where: { ativo: true },
            orderBy: { razaoSocial: 'asc' },
          });
        }

        const memberships = userId ? await tx.userMembership.findMany({ where: { userId } }) : [];
        const contabilidadeIds = new Set<string>();
        const empresaIds = new Set<string>();

        if (contabilidadeId) contabilidadeIds.add(contabilidadeId);
        for (const membership of memberships) {
          if (membership.scopeType === 'contabilidade' && membership.scopeId) {
            contabilidadeIds.add(membership.scopeId);
          }
          if (membership.scopeType === 'empresa' && membership.scopeId) {
            empresaIds.add(membership.scopeId);
          }
        }

        const empresas = new Map<string, unknown>();

        if (contabilidadeIds.size > 0) {
          const links = await tx.contabilidadeEmpresa.findMany({
            where: { contabilidadeId: { in: [...contabilidadeIds] }, ativo: true },
            include: { empresa: true },
          });
          for (const link of links) {
            if (link.empresa.ativo) empresas.set(link.empresa.id, link.empresa);
          }
        }

        if (empresaIds.size > 0) {
          const directEmpresas = await tx.empresa.findMany({
            where: { id: { in: [...empresaIds] }, ativo: true },
          });
          for (const empresa of directEmpresas) {
            empresas.set(empresa.id, empresa);
          }
        }

        return [...empresas.values()];
      },
    );
  }

  private async firstContabilidadeMembership(
    tx: Prisma.TransactionClient,
    userId: string | null,
  ): Promise<string | null> {
    if (!userId) return null;
    const membership = await tx.userMembership.findFirst({
      where: {
        userId,
        scopeType: 'contabilidade',
        role: { in: ['contabilidade_owner', 'contabilidade_operador'] },
      },
      orderBy: { createdAt: 'asc' },
    });
    return membership?.scopeId ?? null;
  }
}
