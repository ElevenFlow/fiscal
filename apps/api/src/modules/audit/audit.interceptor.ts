import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from './audit.service';

export const AUDITABLE_KEY = 'auditable_metadata';

export interface AuditableOptions {
  action: string;
  resourceType?: string;
  resourceIdFrom?: 'params.id' | 'body.id' | 'response.id';
}

/**
 * Decorator para marcar rotas que devem gerar audit_log automaticamente.
 *
 * @example
 * ```ts
 * @Auditable({ action: 'empresa.create', resourceType: 'empresa', resourceIdFrom: 'response.id' })
 * @Post()
 * createEmpresa() {}
 * ```
 */
export const Auditable = (opts: AuditableOptions): MethodDecorator =>
  SetMetadata(AUDITABLE_KEY, opts);

/**
 * AuditInterceptor — lê @Auditable e grava entry em audit_log após execução.
 * Grava result='success' se handler resolve, 'failure' se rejeita.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.get<AuditableOptions | undefined>(
      AUDITABLE_KEY,
      context.getHandler(),
    );
    if (!opts) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<{
      ip?: string;
      headers: Record<string, string | undefined>;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    }>();

    const resolveResourceId = (response?: unknown): string | undefined => {
      if (!opts.resourceIdFrom) return undefined;
      const [source, field] = opts.resourceIdFrom.split('.');
      if (!source || !field) return undefined;
      if (source === 'params') return req.params?.[field];
      if (source === 'body') return req.body?.[field] as string | undefined;
      if (source === 'response' && response && typeof response === 'object') {
        return (response as Record<string, string>)[field];
      }
      return undefined;
    };

    /**
     * REVISÃO WARNING #8 — fire-and-forget via setImmediate.
     *
     * Motivação:
     * 1. `tap(async r => await this.audit.record(...))` adicionava o await da
     *    escrita de audit ao caminho crítico da resposta; qualquer latência no DB
     *    empurrava p99 de TODAS as rotas auditáveis.
     * 2. Pior: se audit.record lançasse, o handler success virava uma exceção
     *    desconhecida ao cliente, mesmo que o trabalho real tivesse dado certo.
     * 3. `catchError(void this.audit.record(...))` silenciava erros do audit e
     *    também do handler — difícil de debugar.
     *
     * setImmediate enfileira depois do tick atual; se record() rejeitar, logamos
     * estruturadamente ('audit_failure') mas a resposta original (seja 2xx ou o
     * throw propagado) NUNCA é mascarada.
     */
    const fireAudit = (result: 'success' | 'failure', response?: unknown): void => {
      setImmediate(() => {
        this.audit
          .record({
            action: opts.action,
            resourceType: opts.resourceType,
            resourceId: result === 'success' ? resolveResourceId(response) : undefined,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            result,
          })
          .catch((err: unknown) => {
            // Log estruturado via Logger; chaves aqui fazem parte do whitelist ALLOWED_LOG_KEYS.
            this.logger.error(
              { action: opts.action, status: result, err: (err as Error).message },
              'audit_failure',
            );
          });
      });
    };

    return next.handle().pipe(
      tap((response) => fireAudit('success', response)),
      catchError((err: unknown) => {
        fireAudit('failure');
        return throwError(() => err);
      }),
    );
  }
}
