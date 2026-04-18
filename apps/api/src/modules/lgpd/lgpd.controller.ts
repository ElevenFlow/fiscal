import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { LgpdService } from './lgpd.service';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
import { getCurrentTenant } from '../../db/tenant-context';

/**
 * LGPD Controller — endpoints do titular (FOUND-12).
 *
 * Auth:
 *  - Plan 01-05 (wave 2): TenantContextMiddleware popula AsyncLocalStorage com
 *    scope.userId a partir do header x-user-id (quando ALLOW_HEADER_AUTH=true em dev/test).
 *    Resolve-se via getCurrentTenant().
 *  - Plan 01-07 (wave 3): ClerkGuard substitui o header-based flow e popula req.auth
 *    com dados do Clerk JWT. TODO: migrar resolveUserId() para ler de req.auth quando Plan 07 entrar.
 *
 * RBAC:
 *  - @Roles cobre os 6 perfis de FOUND-04 (admin + 2 contabilidade + 3 empresa).
 *  - Cada usuário acessa seus PRÓPRIOS dados (userId = req scope userId); admin da
 *    plataforma bypassa via scope.role='platform_admin'.
 *  - RolesGuard é placeholder no Plan 05 — aceita 'admin' apenas com role=platform_admin;
 *    demais roles serão liberadas quando Clerk (Plan 07) popular memberships.
 *    Em dev/test (ALLOW_HEADER_AUTH=true), o header x-role=platform_admin abre os endpoints
 *    para smoke testing — mesmo mecanismo do restante do sistema.
 *
 * Audit:
 *  - Todas as rotas têm @Auditable; AuditInterceptor global (Plan 05) grava entry
 *    imutável em audit_log via setImmediate (fire-and-forget) após resolve/reject.
 */
@Controller('lgpd')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class LgpdController {
  constructor(private readonly lgpd: LgpdService) {}

  /**
   * Resolve userId do scope atual (AsyncLocalStorage populado por TenantContextMiddleware).
   *
   * TODO (Plan 01-07 — Clerk): substituir por `req.auth.userId` populado pelo ClerkGuard.
   * O TenantContextMiddleware continuará populando o store, porém a fonte primária
   * passará a ser o JWT do Clerk em vez do header x-user-id.
   *
   * Segurança (T-09-01): userId vem SEMPRE do scope/auth (não de body/query/params),
   * portanto é impossível para um atacante injetar um id de outro titular.
   */
  private resolveUserId(): string {
    const scope = getCurrentTenant();
    if (!scope || !scope.userId) {
      throw new UnauthorizedException('LGPD endpoints require authenticated user');
    }
    return scope.userId;
  }

  @Get('export')
  @Auditable({ action: 'lgpd.export_data', resourceType: 'user' })
  async export(): Promise<ReturnType<LgpdService['exportTitularData']>> {
    const userId = this.resolveUserId();
    return this.lgpd.exportTitularData(userId);
  }

  @Post('correction-request')
  @Auditable({ action: 'lgpd.correction_request', resourceType: 'user' })
  async correction(
    @Body() body: { field?: string; newValue?: string; justification?: string } | undefined,
  ): Promise<{ status: 'received'; protocoloId: string }> {
    const userId = this.resolveUserId();
    if (!body || !body.field || !body.newValue || !body.justification) {
      throw new BadRequestException('field, newValue e justification são obrigatórios');
    }
    return this.lgpd.requestCorrection(userId, {
      field: body.field,
      newValue: body.newValue,
      justification: body.justification,
    });
  }

  @Post('deletion-request')
  @Auditable({ action: 'lgpd.deletion_request', resourceType: 'user' })
  async deletion(
    @Body() body: { reason?: string } | undefined,
  ): Promise<{ status: 'received'; protocoloId: string }> {
    const userId = this.resolveUserId();
    if (!body || !body.reason) {
      throw new BadRequestException('reason é obrigatório');
    }
    return this.lgpd.requestDeletion(userId, { reason: body.reason });
  }
}
