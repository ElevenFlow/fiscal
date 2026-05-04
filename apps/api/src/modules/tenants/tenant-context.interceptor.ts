import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { type TenantScope, tenantStore } from '../../db/tenant-context';

interface AuthedRequest {
  auth?: {
    userId: string;
    contabilidadeId: string | null;
    role: 'platform_admin' | 'tenant_user';
  };
  headers: Record<string, string | string[] | undefined>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * TenantContextInterceptor — popula o AsyncLocalStorage `tenantStore` baseado em
 * `req.auth` (setado pelo AuthGuard que ja rodou neste ponto).
 *
 * Usar interceptor em vez de middleware é necessário porque middlewares rodam
 * ANTES dos guards em NestJS. Antes, o middleware tentava ler `req.auth` que
 * ainda nao existia e caia em fallback anonymous via `tenantStore.run()`,
 * mascarando qualquer `enterWith()` posterior do AuthGuard. O resultado era
 * todas as requests verem `role=anonymous` em `requireTenant()`.
 *
 * Interceptor wrappa o handler downstream com `tenantStore.run(scope, ...)`,
 * garantindo propagação correta via AsyncLocalStorage para todo o callstack
 * async (controllers + services + Prisma).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const tenantHeader = req.headers['x-tenant-id'];
    const tenantId =
      typeof tenantHeader === 'string' && UUID_REGEX.test(tenantHeader) ? tenantHeader : null;

    const scope: TenantScope = req.auth
      ? {
          tenantId,
          contabilidadeId: req.auth.contabilidadeId,
          userId: req.auth.userId,
          role: req.auth.role,
        }
      : {
          tenantId: null,
          contabilidadeId: null,
          userId: null,
          role: 'anonymous',
        };

    return new Observable<unknown>((subscriber) => {
      tenantStore.run(scope, () => {
        const subscription = next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
        return () => subscription.unsubscribe();
      });
    });
  }
}
