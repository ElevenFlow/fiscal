import {
  BadRequestException,
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
  type FornecedorCreateInput,
  FornecedorCreateSchema,
  type FornecedorListQuery,
  FornecedorListQuerySchema,
  type FornecedorUpdateInput,
  FornecedorUpdateSchema,
  isValidCnpj,
  isValidCpf,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { FornecedoresService } from './fornecedores.service';

@Controller('fornecedores')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class FornecedoresController {
  constructor(private readonly service: FornecedoresService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(FornecedorListQuerySchema)) query: FornecedorListQuery,
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
  @Auditable({
    action: 'fornecedor.create',
    resourceType: 'fornecedor',
    resourceIdFrom: 'response.id',
  })
  create(
    @Body(new ZodValidationPipe(FornecedorCreateSchema)) dto: FornecedorCreateInput,
  ): Promise<unknown> {
    return this.service.create(dto);
  }

  /**
   * Verifica se um CPF/CNPJ já existe em fornecedor do tenant atual (CAD-09).
   * Declarado ANTES de `:id` para precedência de routing.
   */
  @Get('check-duplicate')
  async checkDuplicate(
    @Query('cpfCnpj') cpfCnpj: string | undefined,
  ): Promise<{ exists: boolean; fornecedor?: { id: string; razaoSocial: string } }> {
    if (!cpfCnpj) {
      throw new BadRequestException({
        code: 'MISSING_PARAM',
        message: 'cpfCnpj é obrigatório',
      });
    }
    const sanitized = cpfCnpj.replace(/\D/g, '');
    const isValid =
      sanitized.length === 11 ? isValidCpf(sanitized) : sanitized.length === 14 ? isValidCnpj(sanitized) : false;
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_CPF_CNPJ',
        message: 'CPF/CNPJ inválido',
      });
    }
    const existing = await this.service.findByCpfCnpj(sanitized);
    return existing ? { exists: true, fornecedor: existing } : { exists: false };
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
  @Auditable({
    action: 'fornecedor.update',
    resourceType: 'fornecedor',
    resourceIdFrom: 'params.id',
  })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FornecedorUpdateSchema)) dto: FornecedorUpdateInput,
  ): Promise<unknown> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'fornecedor.delete',
    resourceType: 'fornecedor',
    resourceIdFrom: 'params.id',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
