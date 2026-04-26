import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { BusinessException } from './business.exception';

/**
 * Filter global — converte BusinessException em response JSON 4xx estruturada.
 *
 * Diferença vs HttpException padrão do Nest:
 *  - 4xx aqui é INFO-level no log (esperado, não bug) — não polui Sentry.
 *  - Payload contém `code` machine-readable + `message` pt-BR + `details` opcional.
 *
 * Registrado globalmente em main.ts via `app.useGlobalFilters(new BusinessExceptionFilter())`.
 */
@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessExceptionFilter.name);

  catch(exception: BusinessException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    // 4xx — log info-level. SAFE keys apenas (code, status). Mensagem pode conter
    // pt-BR sem PII porque exceções de domínio NÃO incluem dados do usuário no message.
    this.logger.log(
      { code: exception.code, status: exception.httpStatus },
      'business_exception',
    );

    void reply.status(exception.httpStatus).send({
      code: exception.code,
      message: exception.message,
      details: exception.details,
    });
  }
}
