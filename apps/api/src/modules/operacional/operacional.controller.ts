import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  type AlertasQuery,
  AlertasQuerySchema,
  type DocumentoExportInput,
  DocumentoExportSchema,
  type DocumentoFiscalQuery,
  DocumentoFiscalQuerySchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Roles } from '../rbac/roles.decorator';
import { OperacionalService } from './operacional.service';

@Controller()
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class OperacionalController {
  constructor(private readonly service: OperacionalService) {}

  @Get('documentos')
  listDocumentos(
    @Query(new ZodValidationPipe(DocumentoFiscalQuerySchema)) query: DocumentoFiscalQuery,
  ): Promise<unknown> {
    return this.service.listDocumentos(query);
  }

  @Post('documentos/export')
  exportDocumentos(
    @Body(new ZodValidationPipe(DocumentoExportSchema)) dto: DocumentoExportInput,
  ): Promise<unknown> {
    return this.service.exportDocumentos(dto);
  }

  @Get('alertas')
  listAlertas(
    @Query(new ZodValidationPipe(AlertasQuerySchema)) query: AlertasQuery,
  ): Promise<unknown> {
    return this.service.listAlertas(query);
  }

  @Post('alertas/:id/resolver')
  resolverAlerta(@Param('id') id: string): Promise<unknown> {
    return this.service.resolverAlerta(id);
  }

  @Get('dashboard')
  dashboard(): Promise<unknown> {
    return this.service.dashboard();
  }
}
