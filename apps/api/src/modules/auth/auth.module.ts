import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

/**
 * AuthModule — módulo global de autenticação in-house (Plan 02.1-02).
 *
 * Substitui ClerkStrategy + ClerkGuard (Plan 01-07).
 * AuthGuard é registrado como APP_GUARD em app.module.ts.
 *
 * Providers exportados para uso em outros módulos:
 *  - AuthGuard: consumido via APP_GUARD (não precisa importar explicitamente)
 *  - JwtService: para assinar tokens em outros contextos se necessário
 *  - PasswordService: para reset de senha (Phase 7.1)
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [PasswordService, JwtService, SessionsService, AuthService, AuthGuard],
  exports: [AuthGuard, JwtService, PasswordService],
})
export class AuthModule {}
