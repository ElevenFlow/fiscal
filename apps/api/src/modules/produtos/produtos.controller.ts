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
  type ProdutoCreateInput,
  ProdutoCreateSchema,
  type ProdutoListQuery,
  ProdutoListQuerySchema,
  type ProdutoUpdateInput,
  ProdutoUpdateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { ProdutosService } from './produtos.service';

@Controller('produtos')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ProdutoListQuerySchema)) query: ProdutoListQuery,
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
  @Auditable({ action: 'produto.create', resourceType: 'produto', resourceIdFrom: 'response.id' })
  create(
    @Body(new ZodValidationPipe(ProdutoCreateSchema)) dto: ProdutoCreateInput,
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
  @Auditable({ action: 'produto.update', resourceType: 'produto', resourceIdFrom: 'params.id' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProdutoUpdateSchema)) dto: ProdutoUpdateInput,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({ action: 'produto.delete', resourceType: 'produto', resourceIdFrom: 'params.id' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
