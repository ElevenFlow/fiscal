import { verifyToken } from '@clerk/backend';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Wrapper para o Clerk backend SDK (Plan 07).
 *
 * `verifyToken` valida a assinatura do JWT emitido pelo Clerk usando o
 * `CLERK_SECRET_KEY`. Em dev/test sem Clerk provisionado (secret ausente ou
 * placeholder), `verify()` retorna `null` e o ClerkGuard rejeita com 401 —
 * nunca aceita token sem validação (T-07-01).
 */
@Injectable()
export class ClerkStrategy {
  private readonly logger = new Logger(ClerkStrategy.name);

  private get secretKey(): string | null {
    const key = process.env.CLERK_SECRET_KEY;
    if (!key || key === 'sk_test_REPLACE_ME') return null;
    return key;
  }

  /**
   * Valida JWT e retorna claims essenciais ou null se inválido/expirado.
   *
   * Claims extraídos:
   *  - `sub`            → userId Clerk (`user_xxx`)
   *  - `org_id`         → Clerk Organization id (null se user fora de org)
   *  - `org_role`       → role na Organization (`org:admin`, `org:member`, ...)
   *  - `public_metadata`→ metadata público do user (ex: `role: 'platform_admin'`)
   */
  async verify(token: string): Promise<{
    userId: string;
    orgId: string | null;
    orgRole: string | null;
    publicMetadata: Record<string, unknown>;
  } | null> {
    const secretKey = this.secretKey;
    if (!secretKey) {
      this.logger.warn('CLERK_SECRET_KEY not configured — rejecting all tokens');
      return null;
    }

    try {
      const claims = await verifyToken(token, { secretKey });
      return {
        userId: claims.sub,
        orgId: (claims.org_id as string | undefined) ?? null,
        orgRole: (claims.org_role as string | undefined) ?? null,
        publicMetadata: (claims.public_metadata as Record<string, unknown> | undefined) ?? {},
      };
    } catch (err) {
      // Log só em debug para não poluir logs de prod com erros de token esperados
      this.logger.debug(`Token verification failed: ${(err as Error).message}`);
      return null;
    }
  }
}
