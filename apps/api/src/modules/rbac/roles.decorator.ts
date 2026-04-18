import { SetMetadata } from '@nestjs/common';

/**
 * Roles aceitos (alinhados com REQUIREMENTS.md FOUND-04):
 * - admin                       (platform admin)
 * - contabilidade_owner          (dono do escritório contábil)
 * - contabilidade_operador       (funcionário do escritório)
 * - empresa_owner                (dono da empresa)
 * - empresa_operador             (usuário operacional da empresa)
 * - empresa_leitura              (visualizador read-only)
 */
export type Role =
  | 'admin'
  | 'contabilidade_owner'
  | 'contabilidade_operador'
  | 'empresa_owner'
  | 'empresa_operador'
  | 'empresa_leitura';

export const ROLES_KEY = 'required_roles';

/**
 * Decorator de rota que exige que o user tenha ao menos UM dos roles listados.
 *
 * @example
 * ```ts
 * @Roles('admin', 'contabilidade_owner')
 * @Post('/empresas')
 * createEmpresa() {}
 * ```
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
