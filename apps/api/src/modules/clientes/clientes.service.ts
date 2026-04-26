import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ClienteCreateInput,
  ClienteListQuery,
  ClienteUpdateInput,
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

const SORTABLE_FIELDS = ['nome', 'cpfCnpj', 'createdAt', 'updatedAt'] as const;

/**
 * ClientesService — CRUD multi-tenant de Cliente PF/PJ (Phase 2 Plan 02-02).
 *
 * RLS:
 *  - As queries Prisma rodam dentro do request scope; TenantContextMiddleware
 *    populou `tenantStore` e o ClerkGuard validou a identidade.
 *  - Para que o RLS efetivamente filtre, a query precisa rodar dentro de
 *    uma transação que executou `SET LOCAL app.current_tenant = ...`.
 *    Como o Phase 1 não inseriu `withTenantContext` no caminho dos handlers
 *    HTTP, este service explicitamente usa `requireTenant()` + filtro WHERE
 *    com `tenantId` redundante — RLS é defesa em profundidade, mas o filtro
 *    aplicação primário aqui é via WHERE explícito (defense-in-depth).
 *
 * Soft delete: DELETE seta `ativo=false`. Cadastro físico nunca é apagado
 * (FK fiscal futura — wiki/07-cadastros.md).
 */
@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ClienteListQuery): Promise<PageResult<unknown>> {
    const { tenantId } = requireTenant();
    if (!tenantId) {
      // Sem tenant ativo, lista vazia em vez de listar tudo cross-tenant.
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
    }

    const where: Prisma.ClienteWhereInput = { tenantId };
    if (query.search) {
      const digits = query.search.replace(/\D/g, '');
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ cpfCnpj: { contains: digits } }] : []),
      ];
    }
    if (query.tipoPessoa) where.tipoPessoa = query.tipoPessoa;
    if (query.ativo !== undefined) where.ativo = query.ativo === 'true';

    const orderBy = parseSort(query.sort, {
      allowed: SORTABLE_FIELDS,
      default: { createdAt: 'desc' },
    });

    const [items, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string): Promise<unknown> {
    const { tenantId } = requireTenant();
    const cliente = await this.prisma.cliente.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!cliente) throw new NotFoundResourceException('cliente', id);
    return cliente;
  }

  async create(dto: ClienteCreateInput): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) {
      throw new NotFoundResourceException('cliente', 'no_tenant_context');
    }

    try {
      return await this.prisma.cliente.create({
        data: {
          tenantId,
          tipoPessoa: dto.tipoPessoa,
          cpfCnpj: dto.cpfCnpj,
          nome: dto.nome,
          nomeFantasia: dto.nomeFantasia ?? null,
          inscricaoEst: dto.inscricaoEst ?? null,
          inscricaoMun: dto.inscricaoMun ?? null,
          contribuinteIcms: dto.contribuinteIcms,
          endereco: dto.endereco as Prisma.InputJsonValue,
          email: dto.email ?? null,
          telefone: dto.telefone ?? null,
          observacoes: dto.observacoes ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cpfCnpj', dto.cpfCnpj);
      }
      throw err;
    }
  }

  async update(id: string, dto: ClienteUpdateInput): Promise<unknown> {
    await this.findOne(id); // 404 se de outro tenant
    try {
      const data: Prisma.ClienteUpdateInput = {};
      if (dto.tipoPessoa !== undefined) data.tipoPessoa = dto.tipoPessoa;
      if (dto.cpfCnpj !== undefined) data.cpfCnpj = dto.cpfCnpj;
      if (dto.nome !== undefined) data.nome = dto.nome;
      if (dto.nomeFantasia !== undefined) data.nomeFantasia = dto.nomeFantasia;
      if (dto.inscricaoEst !== undefined) data.inscricaoEst = dto.inscricaoEst;
      if (dto.inscricaoMun !== undefined) data.inscricaoMun = dto.inscricaoMun;
      if (dto.contribuinteIcms !== undefined) data.contribuinteIcms = dto.contribuinteIcms;
      if (dto.endereco !== undefined) data.endereco = dto.endereco as Prisma.InputJsonValue;
      if (dto.email !== undefined) data.email = dto.email;
      if (dto.telefone !== undefined) data.telefone = dto.telefone;
      if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;
      if (dto.ativo !== undefined) data.ativo = dto.ativo;

      return await this.prisma.cliente.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DuplicateException('cpfCnpj', dto.cpfCnpj ?? '');
      }
      throw err;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.cliente.update({ where: { id }, data: { ativo: false } });
  }

  /**
   * findByCpfCnpj — verificação de duplicidade por tenant (Plan 02-03 / CAD-09).
   *
   * Retorna o cliente se já existir no tenant atual com o cpfCnpj informado.
   * Sem tenant ativo, retorna null (não vaza dados cross-tenant — T-02-03-07).
   *
   * Usado pelo endpoint GET /api/clientes/check-duplicate antes do POST para
   * dar feedback em tempo real na UI (alerta de duplicidade — CAD-09).
   */
  async findByCpfCnpj(cpfCnpj: string): Promise<{ id: string; nome: string } | null> {
    const { tenantId } = requireTenant();
    if (!tenantId) return null;
    return this.prisma.cliente.findUnique({
      where: { tenantId_cpfCnpj: { tenantId, cpfCnpj } },
      select: { id: true, nome: true },
    });
  }
}
