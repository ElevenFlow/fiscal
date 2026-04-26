import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Pipe Nest que valida `body`/`query`/`params` usando um schema Zod.
 *
 * Uso:
 * ```ts
 * @Post()
 * @UsePipes(new ZodValidationPipe(ClienteCreateSchema))
 * create(@Body() dto: ClienteCreateInput) { ... }
 * ```
 *
 * Erro retorna `400 BadRequest` com payload estruturado:
 * ```json
 * {
 *   "code": "VALIDATION_ERROR",
 *   "message": "Validation failed",
 *   "errors": [{ "path": "endereco.cep", "message": "CEP deve ter 8 dígitos", "code": "custom" }]
 * }
 * ```
 *
 * Segurança (T-02-02-01): Zod por padrão IGNORA campos extras (não-strict),
 * portanto o output é seguro para spread em `prisma.cliente.create({ data: dto })`.
 * O service NUNCA recebe campos não declarados no schema.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      });
    }
    return parsed.data;
  }
}
