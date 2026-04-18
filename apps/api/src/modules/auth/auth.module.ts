import { Global, Module } from '@nestjs/common';
import { ClerkGuard } from './clerk.guard';
import { ClerkStrategy } from './clerk.strategy';

/**
 * Global auth module — ClerkGuard é registrado como APP_GUARD em app.module.ts
 * para rodar em toda request; aqui exportamos os providers para DI.
 */
@Global()
@Module({
  providers: [ClerkStrategy, ClerkGuard],
  exports: [ClerkStrategy, ClerkGuard],
})
export class AuthModule {}
