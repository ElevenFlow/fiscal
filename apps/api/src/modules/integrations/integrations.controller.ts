import { Controller, Get, Param } from '@nestjs/common';
import { BusinessException } from '../../common/business.exception';
import { Auditable } from '../audit/audit.interceptor';
import { Roles } from '../rbac/roles.decorator';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { BrasilApiService } from './brasilapi.service';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { ViaCepService } from './viacep.service';

/**
 * IntegrationsController — REST endpoints `/api/integrations/*` (Plan 02-03 Task 2).
 *
 * Endpoints:
 *  - GET /api/integrations/cnpj/:cnpj — autopreenchimento CNPJ (BrasilAPI cache 30d)
 *  - GET /api/integrations/cep/:cep — autopreenchimento CEP (ViaCEP cache 90d)
 *
 * Roles: aberto a todos os perfis autenticados (FOUND-04). Operação read-only de
 * dados públicos (CNPJ Receita / CEP Correios) — não vaza informação tenant-scoped.
 *
 * Audit: cada lookup gera audit_log (T-02-03-04 — auditoria substitui rate limit
 * granular do MVP; Phase 7 hardening adiciona RateLimiterMemory 30 req/min/user).
 *
 * TODO Phase 7: rate limit (30 req/min/user). MVP confia no cache (TTL 30/90 dias)
 * + cliente bem-comportado da própria UI; auditoria garante traceability se houver
 * abuso. Implementação completa em IntegrationsController via guard ou interceptor.
 */
@Controller('integrations')
@Roles(
  'admin',
  'contabilidade_owner',
  'contabilidade_operador',
  'empresa_owner',
  'empresa_operador',
  'empresa_leitura',
)
export class IntegrationsController {
  constructor(
    private readonly brasilApi: BrasilApiService,
    private readonly viaCep: ViaCepService,
  ) {}

  @Get('cnpj/:cnpj')
  @Auditable({ action: 'integration.cnpj.lookup', resourceType: 'cnpj_cache' })
  async lookupCnpj(@Param('cnpj') cnpjParam: string) {
    const sanitized = cnpjParam.replace(/\D/g, '');
    if (sanitized.length !== 14) {
      throw new BusinessException('INVALID_CNPJ', 'CNPJ deve ter 14 dígitos', 400);
    }
    return this.brasilApi.fetchCnpj(sanitized);
  }

  @Get('cep/:cep')
  @Auditable({ action: 'integration.cep.lookup', resourceType: 'cep_cache' })
  async lookupCep(@Param('cep') cepParam: string) {
    const sanitized = cepParam.replace(/\D/g, '');
    if (sanitized.length !== 8) {
      throw new BusinessException('INVALID_CEP', 'CEP deve ter 8 dígitos', 400);
    }
    return this.viaCep.fetchCep(sanitized);
  }
}
