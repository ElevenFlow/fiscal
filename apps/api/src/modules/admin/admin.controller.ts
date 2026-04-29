import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type AuditoriaQuery,
  AuditoriaQuerySchema,
  type ConfiguracaoEmpresaInput,
  ConfiguracaoEmpresaSchema,
  type ConfiguracaoPreferenciasInput,
  ConfiguracaoPreferenciasSchema,
  type ConfiguracaoTemplateEmailInput,
  ConfiguracaoTemplateEmailSchema,
  type UsuarioAcaoInput,
  UsuarioAcaoSchema,
  type UsuarioCreateInput,
  UsuarioCreateSchema,
  type UsuariosQuery,
  UsuariosQuerySchema,
  type UsuarioUpdateInput,
  UsuarioUpdateSchema,
} from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
import { AdminService } from './admin.service';

@Controller()
@Roles('admin', 'contabilidade_owner', 'empresa_owner')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('configuracoes')
  configuracoes(): Promise<unknown> {
    return this.service.getConfiguracoes();
  }

  @Patch('configuracoes/empresa')
  @Auditable({ action: 'config.empresa.update', resourceType: 'empresa' })
  updateEmpresa(
    @Body(new ZodValidationPipe(ConfiguracaoEmpresaSchema)) dto: ConfiguracaoEmpresaInput,
  ): Promise<unknown> {
    return this.service.updateEmpresa(dto);
  }

  @Patch('configuracoes/email')
  @Auditable({ action: 'config.email.update', resourceType: 'empresa_config' })
  updateEmail(
    @Body(new ZodValidationPipe(ConfiguracaoTemplateEmailSchema))
    dto: ConfiguracaoTemplateEmailInput,
  ): Promise<unknown> {
    return this.service.updateEmail(dto);
  }

  @Patch('configuracoes/preferencias')
  @Auditable({ action: 'config.preferencias.update', resourceType: 'empresa_config' })
  updatePreferencias(
    @Body(new ZodValidationPipe(ConfiguracaoPreferenciasSchema))
    dto: ConfiguracaoPreferenciasInput,
  ): Promise<unknown> {
    return this.service.updatePreferencias(dto);
  }

  @Get('usuarios')
  usuarios(@Query(new ZodValidationPipe(UsuariosQuerySchema)) query: UsuariosQuery): Promise<unknown> {
    return this.service.listUsuarios(query);
  }

  @Post('usuarios')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({ action: 'usuario.create', resourceType: 'user', resourceIdFrom: 'response.id' })
  createUsuario(
    @Body(new ZodValidationPipe(UsuarioCreateSchema)) dto: UsuarioCreateInput,
  ): Promise<unknown> {
    return this.service.createUsuario(dto);
  }

  @Patch('usuarios/:id')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({ action: 'usuario.update', resourceType: 'user', resourceIdFrom: 'params.id' })
  updateUsuario(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UsuarioUpdateSchema)) dto: UsuarioUpdateInput,
  ): Promise<unknown> {
    return this.service.updateUsuario(id, dto);
  }

  @Post('usuarios/:id/acao')
  @Roles('admin', 'contabilidade_owner', 'empresa_owner')
  @Auditable({ action: 'usuario.action', resourceType: 'user', resourceIdFrom: 'params.id' })
  usuarioAcao(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UsuarioAcaoSchema)) dto: UsuarioAcaoInput,
  ): Promise<unknown> {
    return this.service.usuarioAcao(id, dto);
  }

  @Get('auditoria')
  auditoria(
    @Query(new ZodValidationPipe(AuditoriaQuerySchema)) query: AuditoriaQuery,
  ): Promise<unknown> {
    return this.service.listAuditoria(query);
  }
}
