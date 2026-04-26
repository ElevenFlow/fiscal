import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type SerieCreateInput,
  SerieCreateSchema,
  type SerieUpdateInput,
  SerieUpdateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { SeriesService } from './series.service';

/**
 * REST endpoints — /api/series (Phase 2 Plan 02-06).
 *
 * RBAC (FOUND-04):
 *  - GET (list/findOne): todos os roles que enxergam dados do tenant.
 *  - POST/PATCH: admin / contabilidade_owner / empresa_owner — séries
 *    são configuração fiscal sensível (mudar ambiente HOMOLOGACAO↔PRODUCAO
 *    afeta validade fiscal das notas).
 *  - DELETE: mesmos roles do POST — soft delete (ativa=false).
 *
 * Audit: todas mutações geram audit_log via @Auditable + AuditInterceptor
 * (T-02-06-02). Mudança de ambiente fica capturada no diff antes/depois.
 */
@Controller('series')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class SeriesController {
  constructor(private readonly service: SeriesService) {}

  @Get()
  list(): Promise<unknown[]> {
    return this.service.list() as Promise<unknown[]>;
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'serie.create',
    resourceType: 'serie_fiscal',
    resourceIdFrom: 'response.id',
  })
  create(
    @Body(new ZodValidationPipe(SerieCreateSchema)) dto: SerieCreateInput,
  ): Promise<unknown> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'serie.update',
    resourceType: 'serie_fiscal',
    resourceIdFrom: 'params.id',
  })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SerieUpdateSchema)) dto: SerieUpdateInput,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'serie.deactivate',
    resourceType: 'serie_fiscal',
    resourceIdFrom: 'params.id',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
