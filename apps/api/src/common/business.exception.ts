/**
 * Hierarquia de exceções de NEGÓCIO (4xx) — separadas das exceções de infra (5xx).
 *
 * Motivação (wiki/99-padroes-desenvolvimento.md §9):
 *  - 4xx são esperadas (input inválido, recurso duplicado, faltando) — NÃO devem
 *    poluir Sentry/observability como erros.
 *  - O `BusinessExceptionFilter` captura essa hierarquia e retorna JSON estruturado;
 *    Sentry só captura `Error` não-BusinessException ou status 5xx.
 *
 * Uso:
 * ```ts
 * if (await this.prisma.cliente.findUnique({ where: { ... } }) !== null) {
 *   throw new DuplicateException('cpfCnpj', dto.cpfCnpj);
 * }
 * ```
 */
export class BusinessException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}

/** 409 Conflict — recurso duplicado (constraint UNIQUE). */
export class DuplicateException extends BusinessException {
  constructor(field: string, value: string) {
    super('DUPLICATE_RESOURCE', `Registro duplicado: ${field}=${value}`, 409, { field, value });
    this.name = 'DuplicateException';
  }
}

/** 404 Not Found — recurso inexistente OU em outro tenant (RLS retornou 0 linhas). */
export class NotFoundResourceException extends BusinessException {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} não encontrado: ${id}`, 404, { resource, id });
    this.name = 'NotFoundResourceException';
  }
}

/** 403 Forbidden — domínio rejeita acesso (mesmo com role correto). */
export class ForbiddenResourceException extends BusinessException {
  constructor(message = 'Acesso negado') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenResourceException';
  }
}
