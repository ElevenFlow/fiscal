import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  EstoqueMovimentacaoManualInput,
  EstoqueMovimentacaoQuery,
  XmlCompraUploadInput,
  XmlImportConfirmInput,
} from '@nexo/shared';
import {
  BusinessException,
  DuplicateException,
  NotFoundResourceException,
} from '../../common/business.exception';
import { PrismaService } from '../../db/prisma.service';
import { requireTenant } from '../../db/tenant-context';
import { type ParsedXmlCompraItem, XmlCompraParserService } from './xml-compra-parser.service';

type Tx = Prisma.TransactionClient;

interface ImportItem extends ParsedXmlCompraItem {
  sugestaoProdutoId: string | null;
  sugestaoCodigo: string | null;
  sugestaoDescricao: string | null;
}

interface ImportItemJson {
  itens?: ImportItem[];
}

const XML_IMPORT_STATUS = {
  PENDENTE_REVISAO: 'PENDENTE_REVISAO',
  PROCESSADO: 'PROCESSADO',
} as const;

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function signedQuantity(
  tipo: string,
  quantidade: string | Prisma.Decimal | number,
): Prisma.Decimal {
  const decimal = new Prisma.Decimal(quantidade);
  return tipo === 'saida' ? decimal.mul(-1) : decimal;
}

@Injectable()
export class EstoqueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: XmlCompraParserService,
  ) {}

  async listImportacoes(): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) return [];
    return this.prisma.xmlImportacao.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async uploadXml(dto: XmlCompraUploadInput): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) throw new NotFoundResourceException('tenant', 'no_tenant_context');

    const parsed = this.parser.parse(dto.xml);
    const duplicate = await this.prisma.xmlImportacao.findUnique({
      where: { tenantId_chaveAcesso: { tenantId, chaveAcesso: parsed.chaveAcesso } },
    });
    if (duplicate) throw new DuplicateException('chaveAcesso', parsed.chaveAcesso);

    const itens = await this.enrichSuggestions(tenantId, parsed.itens);
    return this.prisma.xmlImportacao.create({
      data: {
        tenantId,
        chaveAcesso: parsed.chaveAcesso,
        arquivoNome: dto.fileName,
        fornecedorNome: parsed.fornecedorNome,
        fornecedorCnpj: parsed.fornecedorCnpj,
        emitidaEm: parsed.emitidaEm,
        valorTotal: parsed.valorTotal,
        status: XML_IMPORT_STATUS.PENDENTE_REVISAO,
        itens: itens as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findImportacao(id: string): Promise<unknown> {
    const { tenantId } = requireTenant();
    const row = await this.prisma.xmlImportacao.findFirst({
      where: tenantId ? { id, tenantId } : { id },
    });
    if (!row) throw new NotFoundResourceException('xml_importacao', id);
    return row;
  }

  async confirmarImportacao(id: string, dto: XmlImportConfirmInput): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) throw new NotFoundResourceException('tenant', 'no_tenant_context');

    return this.prisma.$transaction(async (tx) => {
      const importacao = await tx.xmlImportacao.findFirst({
        where: { id, tenantId },
      });
      if (!importacao) throw new NotFoundResourceException('xml_importacao', id);
      if (importacao.status !== XML_IMPORT_STATUS.PENDENTE_REVISAO) {
        throw new BusinessException(
          'XML_IMPORTACAO_JA_PROCESSADA',
          'Importacao XML nao esta pendente de revisao',
          409,
        );
      }

      const itensImportados = Array.isArray(importacao.itens)
        ? (importacao.itens as unknown as ImportItem[])
        : ((importacao.itens as ImportItemJson).itens ?? []);
      const itemMap = new Map(itensImportados.map((item) => [item.id, item]));
      const createdMovs: unknown[] = [];

      for (const decision of dto.decisions) {
        const item = itemMap.get(decision.itemId);
        if (!item) continue;
        if (decision.acao === 'ignorar') continue;

        const produto =
          decision.acao === 'vincular'
            ? await this.findProdutoForUpdate(tx, tenantId, decision.produtoId)
            : await tx.produto.create({
                data: {
                  tenantId,
                  codigo: decision.codigo,
                  descricao: decision.descricao,
                  ncm: decision.ncm,
                  unidade: decision.unidade,
                  origemMercadoria: 0,
                  precoCusto: item.valorUnitario,
                  precoVenda: decision.precoVenda,
                  estoqueInicial: '0',
                },
              });

        const mov = await this.createMovement(tx, tenantId, {
          produtoId: produto.id,
          produtoCodigo: produto.codigo,
          produtoDescricao: produto.descricao,
          tipo: 'entrada',
          origem: 'xml',
          origemId: id,
          xmlImportacaoId: id,
          quantidade: item.quantidade,
          motivo: `Importacao XML ${importacao.chaveAcesso}`,
        });
        createdMovs.push(mov);
      }

      await tx.xmlImportacao.update({
        where: { id },
        data: { status: XML_IMPORT_STATUS.PROCESSADO, confirmedAt: new Date() },
      });

      return { id, status: XML_IMPORT_STATUS.PROCESSADO, movimentacoes: createdMovs };
    });
  }

  async listMovimentacoes(query: EstoqueMovimentacaoQuery): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) return [];

    const where: Prisma.MovimentacaoEstoqueWhereInput = { tenantId };
    if (query.tipo) where.tipo = query.tipo;
    if (query.origem) where.origem = query.origem;
    if (query.search) {
      where.OR = [
        { produtoCodigo: { contains: query.search, mode: 'insensitive' } },
        { produtoDescricao: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.dataInicio || query.dataFim) {
      where.createdAt = {};
      if (query.dataInicio) where.createdAt.gte = new Date(query.dataInicio);
      if (query.dataFim) where.createdAt.lte = new Date(query.dataFim);
    }

    return this.prisma.movimentacaoEstoque.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createMovimentacaoManual(dto: EstoqueMovimentacaoManualInput): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) throw new NotFoundResourceException('tenant', 'no_tenant_context');

    return this.prisma.$transaction(async (tx) => {
      const produto = await this.findProdutoForUpdate(tx, tenantId, dto.produtoId);
      return this.createMovement(tx, tenantId, {
        produtoId: produto.id,
        produtoCodigo: produto.codigo,
        produtoDescricao: produto.descricao,
        tipo: dto.tipo,
        origem: 'manual',
        origemId: null,
        xmlImportacaoId: null,
        quantidade: dto.quantidade,
        motivo: dto.motivo,
      });
    });
  }

  async posicaoEstoque(): Promise<unknown> {
    const { tenantId } = requireTenant();
    if (!tenantId) return [];

    const [produtos, saldos] = await Promise.all([
      this.prisma.produto.findMany({
        where: { tenantId, ativo: true },
        select: {
          id: true,
          codigo: true,
          descricao: true,
          ncm: true,
          unidade: true,
          estoqueMinimo: true,
        },
        orderBy: { descricao: 'asc' },
      }),
      this.prisma.movimentacaoEstoque.groupBy({
        by: ['produtoId'],
        where: { tenantId, produtoId: { not: null } },
        _sum: { quantidade: true },
      }),
    ]);

    const saldoByProduto = new Map(
      saldos.map((row) => [row.produtoId, toNumber(row._sum.quantidade)]),
    );
    return produtos.map((produto) => {
      const saldoAtual = saldoByProduto.get(produto.id) ?? 0;
      const estoqueMinimo = toNumber(produto.estoqueMinimo);
      return {
        ...produto,
        saldoAtual,
        estoqueCritico: estoqueMinimo > 0 && saldoAtual < estoqueMinimo,
      };
    });
  }

  private async enrichSuggestions(
    tenantId: string,
    itens: ParsedXmlCompraItem[],
  ): Promise<ImportItem[]> {
    const ncms = Array.from(new Set(itens.map((item) => item.ncm).filter(Boolean)));
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, ncm: { in: ncms }, ativo: true },
      select: { id: true, codigo: true, descricao: true, ncm: true, unidade: true },
    });

    return itens.map((item) => {
      const itemText = item.descricao.toLowerCase();
      const match =
        produtos.find(
          (produto) =>
            produto.ncm === item.ncm &&
            produto.unidade.toUpperCase() === item.unidade.toUpperCase() &&
            (itemText.includes(produto.descricao.toLowerCase().slice(0, 16)) ||
              produto.descricao.toLowerCase().includes(itemText.slice(0, 16))),
        ) ?? produtos.find((produto) => produto.ncm === item.ncm);

      return {
        ...item,
        sugestaoProdutoId: match?.id ?? null,
        sugestaoCodigo: match?.codigo ?? null,
        sugestaoDescricao: match?.descricao ?? null,
      };
    });
  }

  private async findProdutoForUpdate(tx: Tx, tenantId: string, produtoId: string) {
    await tx.$queryRaw`SELECT id FROM produtos WHERE id = ${produtoId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
    const produto = await tx.produto.findFirst({ where: { id: produtoId, tenantId } });
    if (!produto) throw new NotFoundResourceException('produto', produtoId);
    return produto;
  }

  private async createMovement(
    tx: Tx,
    tenantId: string,
    input: {
      produtoId: string;
      produtoCodigo: string;
      produtoDescricao: string;
      tipo: 'entrada' | 'saida' | 'ajuste' | 'estorno';
      origem: 'xml' | 'nfe' | 'manual';
      origemId: string | null;
      xmlImportacaoId: string | null;
      quantidade: string;
      motivo: string;
    },
  ) {
    const quantidade = signedQuantity(input.tipo, input.quantidade);
    const aggregate = await tx.movimentacaoEstoque.aggregate({
      where: { tenantId, produtoId: input.produtoId },
      _sum: { quantidade: true },
    });
    const saldoApos = new Prisma.Decimal(aggregate._sum.quantidade ?? 0).plus(quantidade);

    return tx.movimentacaoEstoque.create({
      data: {
        tenantId,
        produtoId: input.produtoId,
        xmlImportacaoId: input.xmlImportacaoId,
        produtoCodigo: input.produtoCodigo,
        produtoDescricao: input.produtoDescricao,
        tipo: input.tipo,
        origem: input.origem,
        origemId: input.origemId,
        quantidade,
        saldoApos,
        motivo: input.motivo,
      },
    });
  }
}
