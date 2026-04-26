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
  type ClienteCreateInput,
  ClienteCreateSchema,
  type ClienteListQuery,
  ClienteListQuerySchema,
  type ClienteUpdateInput,
  ClienteUpdateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { ClientesService } from './clientes.service';

/**
 * REST endpoints — /api/clientes (Phase 2 Plan 02-02).
 *
 * RBAC (FOUND-04):
 *  - GET (list/findOne): todos os roles que enxergam dados do tenant.
 *  - POST/PATCH: owner/operador da contabilidade ou empresa (ações de mutação).
 *  - DELETE: apenas owner (contabilidade ou empresa) — soft delete.
 *
 * Audit: cada mutation gera audit_log via @Auditable + AuditInterceptor (Plan 01-05).
 *
 * Validação: ZodValidationPipe roda ANTES do service (Plan 02-02). Schemas em @nexo/shared.
 */
@Controller('clientes')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ClienteListQuerySchema)) query: ClienteListQuery,
  ): Promise<unknown> {
    return this.service.list(query);
  }

  @Post()
  @Roles(
    'admin',
    'contabilidade_owner',
    'contabilidade_operador',
    'empresa_owner',
    'empresa_operador',
  )
  @Auditable({ action: 'cliente.create', resourceType: 'cliente', resourceIdFrom: 'response.id' })
  create(
    @Body(new ZodValidationPipe(ClienteCreateSchema)) dto: ClienteCreateInput,
  ): Promise<unknown> {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(
    'admin',
    'contabilidade_owner',
    'contabilidade_operador',
    'empresa_owner',
    'empresa_operador',
  )
  @Auditable({ action: 'cliente.update', resourceType: 'cliente', resourceIdFrom: 'params.id' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ClienteUpdateSchema)) dto: ClienteUpdateInput,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({ action: 'cliente.delete', resourceType: 'cliente', resourceIdFrom: 'params.id' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
