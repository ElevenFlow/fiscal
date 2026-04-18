import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { getCurrentTenant } from '../../db/tenant-context';

/**
 * Guard que rejeita a request se TenantScope não está populado (user não autenticado).
 * Aplicar em rotas protegidas; health/webhooks ficam fora.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    const scope = getCurrentTenant();
    if (!scope) {
      throw new UnauthorizedException('No tenant context — missing authentication');
    }
    if (scope.role === 'anonymous') {
      throw new UnauthorizedException('Anonymous access not allowed on this route');
    }
    return true;
  }
}
