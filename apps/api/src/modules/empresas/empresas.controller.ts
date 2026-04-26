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
  type EmpresaCreateInput,
  EmpresaCreateSchema,
  type EmpresaListQuery,
  EmpresaListQuerySchema,
  type EmpresaUpdateInput,
  EmpresaUpdateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { EmpresasService } from './empresas.service';

/**
 * REST endpoints — /api/empresas (Phase 2 Plan 02-02).
 *
 * Empresa É o tenant — RBAC mais restrito que cadastros normais:
 *  - List/findOne: todos os roles do tenant + admin (todos podem ver dados da empresa).
 *  - Create/Update: APENAS admin + contabilidade_owner (decisão estrutural — empresa
 *    é onboarding contábil; operadores não criam novos tenants).
 *  - Delete (soft): APENAS admin + contabilidade_owner.
 *  - GET /api/empresas/minhas: lista empresas da contabilidade do user — consumido
 *    pelo EmpresaSwitcher web (Plan 02-09 fallback). Sem @Roles restritivo,
 *    todos os roles autenticados podem listar suas próprias empresas.
 */
@Controller('empresas')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class EmpresasController {
  constructor(private readonly service: EmpresasService) {}

  /**
   * Endpoint identity-scoped (não tenant-scoped) — registrado ANTES de :id
   * para evitar match em "minhas" como :id param.
   */
  @Get('minhas')
  minhas(): Promise<unknown[]> {
    return this.service.findMinhas();
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(EmpresaListQuerySchema)) query: EmpresaListQuery,
  ): Promise<unknown> {
    return this.service.list(query);
  }

  @Post()
  @Roles('admin', 'contabilidade_owner')
  @Auditable({ action: 'empresa.create', resourceType: 'empresa', resourceIdFrom: 'response.id' })
  create(
    @Body(new ZodValidationPipe(EmpresaCreateSchema)) dto: EmpresaCreateInput,
  ): Promise<unknown> {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({ action: 'empresa.update', resourceType: 'empresa', resourceIdFrom: 'params.id' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EmpresaUpdateSchema)) dto: EmpresaUpdateInput,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner')
  @Auditable({ action: 'empresa.delete', resourceType: 'empresa', resourceIdFrom: 'params.id' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
