import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  type EstoqueMovimentacaoManualInput,
  EstoqueMovimentacaoManualSchema,
  type EstoqueMovimentacaoQuery,
  EstoqueMovimentacaoQuerySchema,
  type XmlCompraUploadInput,
  XmlCompraUploadSchema,
  type XmlImportConfirmInput,
  XmlImportConfirmSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
import { EstoqueService } from './estoque.service';

@Controller('estoque')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class EstoqueController {
  constructor(private readonly service: EstoqueService) {}

  @Get('importacoes')
  listImportacoes(): Promise<unknown> {
    return this.service.listImportacoes();
  }

  @Post('importacoes/xml')
  @Roles(
    'admin',
    'contabilidade_owner',
    'contabilidade_operador',
    'empresa_owner',
    'empresa_operador',
  )
  @Auditable({ action: 'xml_importacao.upload', resourceType: 'xml_importacao', resourceIdFrom: 'response.id' })
  uploadXml(
    @Body(new ZodValidationPipe(XmlCompraUploadSchema)) dto: XmlCompraUploadInput,
  ): Promise<unknown> {
    return this.service.uploadXml(dto);
  }

  @Get('importacoes/:id')
  findImportacao(@Param('id') id: string): Promise<unknown> {
    return this.service.findImportacao(id);
  }

  @Post('importacoes/:id/confirmar')
  @Roles(
    'admin',
    'contabilidade_owner',
    'contabilidade_operador',
    'empresa_owner',
    'empresa_operador',
  )
  @Auditable({ action: 'xml_importacao.confirm', resourceType: 'xml_importacao', resourceIdFrom: 'params.id' })
  confirmarImportacao(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(XmlImportConfirmSchema)) dto: XmlImportConfirmInput,
  ): Promise<unknown> {
    return this.service.confirmarImportacao(id, dto);
  }

  @Get('movimentacoes')
  listMovimentacoes(
    @Query(new ZodValidationPipe(EstoqueMovimentacaoQuerySchema)) query: EstoqueMovimentacaoQuery,
  ): Promise<unknown> {
    return this.service.listMovimentacoes(query);
  }

  @Post('movimentacoes')
  @Roles(
    'admin',
    'contabilidade_owner',
    'contabilidade_operador',
    'empresa_owner',
    'empresa_operador',
  )
  @Auditable({ action: 'estoque.movimentacao_manual', resourceType: 'movimentacao_estoque', resourceIdFrom: 'response.id' })
  createMovimentacaoManual(
    @Body(new ZodValidationPipe(EstoqueMovimentacaoManualSchema)) dto: EstoqueMovimentacaoManualInput,
  ): Promise<unknown> {
    return this.service.createMovimentacaoManual(dto);
  }

  @Get('posicao')
  posicaoEstoque(): Promise<unknown> {
    return this.service.posicaoEstoque();
  }
}
