import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  DevolucaoDraftCreateSchema,
  type DevolucaoDraftCreateInput,
  NfseDraftCreateSchema,
  type NfseDraftCreateInput,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
import { FiscalService } from './fiscal.service';

@Controller('fiscal')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class FiscalPhase4Controller {
  constructor(private readonly service: FiscalService) {}

  @Get('nfse')
  listNfse(): Promise<unknown[]> {
    return this.service.listNfse();
  }

  @Post('nfse/drafts')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner', 'empresa_operador')
  @Auditable({
    action: 'nfse.draft.create',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'response.id',
  })
  createNfseDraft(
    @Body(new ZodValidationPipe(NfseDraftCreateSchema)) dto: NfseDraftCreateInput,
  ): Promise<unknown> {
    return this.service.createNfseDraft(dto);
  }

  @Post('nfse/:id/autorizar-interno')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner', 'empresa_operador')
  @Auditable({
    action: 'nfse.internal_authorize',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'params.id',
  })
  authorizeNfseInternal(@Param('id') id: string): Promise<unknown> {
    return this.service.authorizeInternal(id, 'NFSE');
  }

  @Get('nfse/:id/xml')
  getNfseXml(@Param('id') id: string): Promise<unknown> {
    return this.service.getXml(id);
  }

  @Get('nfse/:id/danfse')
  getDanfse(@Param('id') id: string): Promise<unknown> {
    return this.service.getDanfe(id);
  }

  @Get('devolucoes')
  listDevolucoes(): Promise<unknown[]> {
    return this.service.listDevolucoes();
  }

  @Post('devolucoes/drafts')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner', 'empresa_operador')
  @Auditable({
    action: 'devolucao.draft.create',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'response.id',
  })
  createDevolucaoDraft(
    @Body(new ZodValidationPipe(DevolucaoDraftCreateSchema)) dto: DevolucaoDraftCreateInput,
  ): Promise<unknown> {
    return this.service.createDevolucaoDraft(dto);
  }

  @Post('devolucoes/:id/autorizar-interno')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner', 'empresa_operador')
  @Auditable({
    action: 'devolucao.internal_authorize',
    resourceType: 'nota_fiscal',
    resourceIdFrom: 'params.id',
  })
  authorizeDevolucaoInternal(@Param('id') id: string): Promise<unknown> {
    return this.service.authorizeInternal(id, 'DEVOLUCAO');
  }

  @Get('devolucoes/:id/xml')
  getDevolucaoXml(@Param('id') id: string): Promise<unknown> {
    return this.service.getXml(id);
  }

  @Get('devolucoes/:id/danfe')
  getDevolucaoDanfe(@Param('id') id: string): Promise<unknown> {
    return this.service.getDanfe(id);
  }
}
