import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type ContabilidadeCreateInput,
  ContabilidadeCreateSchema,
  type ContabilidadeListQuery,
  ContabilidadeListQuerySchema,
  type ContabilidadeUpdateInput,
  ContabilidadeUpdateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { ContabilidadesService } from './contabilidades.service';

/**
 * REST endpoints — /api/contabilidades (Phase 2 Plan 02-02).
 *
 * RBAC restrito (Contabilidade é entidade top-level — escritório contábil):
 *  - List/findOne: admin + contabilidade_owner + contabilidade_operador.
 *  - Create/Update/Delete: APENAS admin (platform). contabilidade_owner pode
 *    editar apenas a própria contabilidade — defesa adicional no service.
 */
@Controller('contabilidades')
@Roles('admin', 'contabilidade_owner', 'contabilidade_operador')
export class ContabilidadesController {
  constructor(private readonly service: ContabilidadesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ContabilidadeListQuerySchema)) query: ContabilidadeListQuery,
  ): Promise<unknown> {
    return this.service.list(query);
  }

  @Post()
  @Roles('admin')
  @Auditable({
    action: 'contabilidade.create',
    resourceType: 'contabilidade',
    resourceIdFrom: 'response.id',
  })
  create(
    @Body(new ZodValidationPipe(ContabilidadeCreateSchema)) dto: ContabilidadeCreateInput,
  ): Promise<unknown> {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'contabilidade_owner')
  @Auditable({
    action: 'contabilidade.update',
    resourceType: 'contabilidade',
    resourceIdFrom: 'params.id',
  })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ContabilidadeUpdateSchema)) dto: ContabilidadeUpdateInput,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin')
  @Auditable({
    action: 'contabilidade.delete',
    resourceType: 'contabilidade',
    resourceIdFrom: 'params.id',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
