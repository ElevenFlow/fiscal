import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../rbac/roles.decorator';
import { LookupService } from './lookup.service';

/**
 * LookupController — autocomplete REST de catálogos fiscais (Plan 02-08, CAD-10).
 *
 * Rotas:
 *  - GET /api/lookup/{type}?q={query}&limit={n}
 *
 * Tipos suportados: ncm | cest | cfop | lc116. `q` opcional (sem query
 * retorna primeiras N entradas). `limit` default 30, hard-cap 100.
 *
 * RBAC: aberto a todos os 6 perfis autenticados — autocomplete de NCM/CFOP
 * é necessário em qualquer formulário de cadastro de produto/serviço.
 *
 * Não há @Auditable — autocomplete em catálogo público é leitura de baixo
 * valor que não precisa de audit trail (poluição de audit_log).
 */
@Controller('lookup')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class LookupController {
  constructor(private readonly service: LookupService) {}

  @Get(':type')
  search(
    @Param('type') type: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): ReturnType<LookupService['search']> {
    const parsedLimit = limit ? Number(limit) : 30;
    const finalLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 30;
    return this.service.search(type, q, finalLimit);
  }
}
