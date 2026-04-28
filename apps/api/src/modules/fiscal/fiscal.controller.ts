import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  FiscalAmbienteSchema,
  type NfeCancelInput,
  NfeCancelSchema,
  type NfeDraftCreateInput,
  NfeDraftCreateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
import { FiscalService } from './fiscal.service';

@Controller('fiscal/nfe')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class FiscalController {
  constructor(private readonly service: FiscalService) {}

  @Get('status-servico')
  statusServico(@Query('ambiente') ambiente = 'HOMOLOGACAO'): Promise<unknown> {
    const parsed = FiscalAmbienteSchema.parse(ambiente);
    return this.service.statusServico(parsed);
  }

  @Get()
  list(): Promise<unknown[]> {
    return this.service.list();
  }

  @Get(':id/xml')
  getXml(@Param('id') id: string): Promise<unknown> {
    return this.service.getXml(id);
  }

  @Get(':id/danfe')
  getDanfe(@Param('id') id: string): Promise<unknown> {
    return this.service.getDanfe(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.service.findOne(id);
  }

  @Post('drafts')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner', 'empresa_operador')
  @Auditable({
    action: 'nfe.draft.create',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'response.id',
  })
  createDraft(
    @Body(new ZodValidationPipe(NfeDraftCreateSchema)) dto: NfeDraftCreateInput,
  ): Promise<unknown> {
    return this.service.createDraft(dto);
  }

  @Post(':id/emitir')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner', 'empresa_operador')
  @Auditable({
    action: 'nfe.emit.enqueue',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'params.id',
  })
  emitir(@Param('id') id: string): Promise<unknown> {
    return this.service.enqueueEmission(id);
  }

  @Post(':id/processar-agora')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'nfe.emit.process_now',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'params.id',
  })
  processarAgora(@Param('id') id: string): Promise<unknown> {
    return this.service.processEmissionNow(id);
  }

  @Post(':id/cancelar')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({
    action: 'nfe.cancel',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'params.id',
  })
  cancelar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(NfeCancelSchema)) dto: NfeCancelInput,
  ): Promise<unknown> {
    return this.service.cancel(id, dto);
  }
}
