import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SigninSchema, SignupSchema } from '@nexo/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Auditable } from '../audit/audit.interceptor';
import { ACCESS_COOKIE, AuthContext, Public, REFRESH_COOKIE } from './auth.guard';
import { AuthService } from './auth.service';

/** TTL do access token em segundos (15 min). */
const ACCESS_TTL_S = 15 * 60;
/** TTL do refresh token em segundos (7 dias). */
const REFRESH_TTL_S = 7 * 24 * 3600;

/**
 * Opções base de cookie para nf_access e nf_refresh.
 * Secure: true apenas em produção (T-02.1-02-06).
 */
function cookieOpts(maxAge: number, path = '/') {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path,
    maxAge, // segundos
  };
}

interface ReqWithAuth extends FastifyRequest {
  auth?: AuthContext;
}

/**
 * AuthController — endpoints de autenticação in-house (Plan 02.1-02).
 *
 * Endpoints:
 *  - POST /api/auth/signup   @Public — cria user + session, seta cookies
 *  - POST /api/auth/signin   @Public — valida credenciais, seta cookies
 *  - POST /api/auth/signout          — revoga session, limpa cookies
 *  - POST /api/auth/refresh  @Public — rotaciona refresh token, emite novos cookies
 *  - GET  /api/auth/me               — retorna user autenticado
 *
 * Cookies:
 *  - nf_access: HttpOnly, SameSite=Lax, Path=/, MaxAge=15min (JWT HS256)
 *  - nf_refresh: HttpOnly, SameSite=Lax, Path=/api/auth/refresh, MaxAge=7d (opaque hex)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Auditable({ action: 'auth.signup', resourceType: 'user', resourceIdFrom: 'response.id' })
  async signup(
    @Body(new ZodValidationPipe(SignupSchema))
    body: { email: string; password: string; fullName: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip ?? null;
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;
    const result = await this.auth.signup(body, ip, ua);

    reply.setCookie(ACCESS_COOKIE, result.accessToken, cookieOpts(ACCESS_TTL_S));
    reply.setCookie(
      REFRESH_COOKIE,
      result.refreshToken,
      cookieOpts(REFRESH_TTL_S, '/api/auth/refresh'),
    );
    return { user: result.user };
  }

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Auditable({ action: 'auth.signin', resourceType: 'user' })
  async signin(
    @Body(new ZodValidationPipe(SigninSchema)) body: { email: string; password: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip ?? null;
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;
    const result = await this.auth.signin(body, ip, ua);

    reply.setCookie(ACCESS_COOKIE, result.accessToken, cookieOpts(ACCESS_TTL_S));
    reply.setCookie(
      REFRESH_COOKIE,
      result.refreshToken,
      cookieOpts(REFRESH_TTL_S, '/api/auth/refresh'),
    );
    return { user: result.user };
  }

  @Post('signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Auditable({ action: 'auth.signout', resourceType: 'user' })
  async signout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_COOKIE];
    if (refreshToken) await this.auth.signout(refreshToken);

    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth/refresh' });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('Refresh token ausente');

    const result = await this.auth.refresh(refreshToken);

    reply.setCookie(ACCESS_COOKIE, result.accessToken, cookieOpts(ACCESS_TTL_S));
    reply.setCookie(
      REFRESH_COOKIE,
      result.refreshToken,
      cookieOpts(REFRESH_TTL_S, '/api/auth/refresh'),
    );
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: ReqWithAuth) {
    if (!req.auth) throw new UnauthorizedException('Não autenticado');
    return this.auth.me(req.auth.userId);
  }
}
