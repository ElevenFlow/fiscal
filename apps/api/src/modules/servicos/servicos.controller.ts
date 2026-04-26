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
  type ServicoCreateInput,
  ServicoCreateSchema,
  type ServicoListQuery,
  ServicoListQuerySchema,
  type ServicoUpdateInput,
  ServicoUpdateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { ServicosService } from './servicos.service';

@Controller('servicos')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class ServicosController {
  constructor(private readonly service: ServicosService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ServicoListQuerySchema)) query: ServicoListQuery,
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
  @Auditable({ action: 'servico.create', resourceType: 'servico', resourceIdFrom: 'response.id' })
  create(
    @Body(new ZodValidationPipe(ServicoCreateSchema)) dto: ServicoCreateInput,
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
  @Auditable({ action: 'servico.update', resourceType: 'servico', resourceIdFrom: 'params.id' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ServicoUpdateSchema)) dto: ServicoUpdateInput,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({ action: 'servico.delete', resourceType: 'servico', resourceIdFrom: 'params.id' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
