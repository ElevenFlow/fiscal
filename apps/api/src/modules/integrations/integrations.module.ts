import { Module } from '@nestjs/common';
import { BrasilApiService } from './brasilapi.service';
import { IntegrationsController } from './integrations.controller';
import { ViaCepService } from './viacep.service';

/**
 * IntegrationsModule (Plan 02-03 Task 2) — autopreenchimento externo.
 *
 * Provê:
 *  - BrasilApiService (CNPJ → razão social, endereço, CNAE)
 *  - ViaCepService (CEP → endereço)
 *
 * Consome:
 *  - PrismaService (DbModule global)
 *  - cnpj_cache / cep_cache (Plan 02-01 schema)
 *
 * Exports os services para outros módulos poderem chamar fetchCnpj/fetchCep
 * (ex: ClientesService futuro pode pré-popular endereço no create se quiser).
 */
@Module({
  controllers: [IntegrationsController],
  providers: [BrasilApiService, ViaCepService],
  exports: [BrasilApiService, ViaCepService],
})
export class IntegrationsModule {}
