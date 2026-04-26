import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { loadEnv } from './config/env';
import { DbModule } from './db/db.module';
import { LoggerModule } from './logger/logger.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClerkGuard } from './modules/auth/clerk.guard';
// === Phase 2 Cadastros (02-02) imports — DO NOT MOVE; 02-04 + 02-06 append below ===
import { ClientesModule } from './modules/clientes/clientes.module';
import { ContabilidadesModule } from './modules/contabilidades/contabilidades.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { FornecedoresModule } from './modules/fornecedores/fornecedores.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { ServicosModule } from './modules/servicos/servicos.module';
// === End Phase 2 Cadastros imports ===
// === Phase 2 Certificados (02-04) imports — DO NOT MOVE; 02-06 appends below ===
import { CertificadosModule } from './modules/certificados/certificados.module';
// === End Phase 2 Certificados imports ===
// === Phase 2 Series (02-06) imports — DO NOT MOVE ===
import { SeriesModule } from './modules/series/series.module';
// === End Phase 2 Series imports ===
// === Phase 2 Integrations (02-03) imports — DO NOT MOVE ===
import { IntegrationsModule } from './modules/integrations/integrations.module';
// === End Phase 2 Integrations imports ===
import { HealthModule } from './modules/health/health.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { SentryModule } from './modules/observability/sentry.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RolesGuard } from './modules/rbac/roles.guard';
import { StorageModule } from './modules/storage/storage.module';
import { TenantsModule } from './modules/tenants/tenants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: () => loadEnv(),
    }),
    LoggerModule,
    DbModule,
    AuthModule, // Clerk (Plan 07) — ClerkStrategy + ClerkGuard providers
    TenantsModule, // aplica TenantContextMiddleware globalmente
    RbacModule,
    AuditModule,
    StorageModule, // S3Service + ObjectLockVerifier (FOUND-11)
    LgpdModule, // Portal do titular (FOUND-12) — BLOCKER #2 Option A
    SentryModule, // Observability — Sentry bootstrap no-op sem DSN (Plan 01-10)
    HealthModule,
    // === Phase 2 Cadastros (02-02) — DO NOT MOVE; 02-04 + 02-06 append below ===
    ClientesModule,
    FornecedoresModule,
    ProdutosModule,
    ServicosModule,
    EmpresasModule,
    ContabilidadesModule,
    // === End Phase 2 Cadastros ===
    // === Phase 2 Certificados (02-04) — DO NOT MOVE; 02-06 appends below ===
    CertificadosModule,
    // === End Phase 2 Certificados ===
    // === Phase 2 Series (02-06) — DO NOT MOVE ===
    SeriesModule,
    // === End Phase 2 Series ===
    // === Phase 2 Integrations (02-03) — DO NOT MOVE ===
    IntegrationsModule,
    // === End Phase 2 Integrations ===
  ],
  providers: [
    // Ordem CRÍTICA (Plan 07):
    //  1. ClerkGuard valida JWT → popula req.auth
    //  2. RolesGuard lê req.auth e autoriza via user_memberships lookup
    // Inverter a ordem faria RolesGuard ver req.auth=undefined e falhar 403 sempre.
    {
      provide: APP_GUARD,
      useClass: ClerkGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Aplica RBAC globalmente; rotas sem @Roles() passam (early return)
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor, // Aplica globalmente; só grava se @Auditable() está presente
    },
  ],
})
export class AppModule {}
