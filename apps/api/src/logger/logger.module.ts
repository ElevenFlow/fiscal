import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { REDACT_PATHS, REDACT_CENSOR } from './redact-paths';

/**
 * Pino logger module com redact allowlist para PII (FOUND-10).
 * Em dev usa pino-pretty; em produção, JSON estruturado para ingestão por SIEM.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      useFactory: () => {
        const isDev = process.env.NODE_ENV !== 'production';
        return {
          pinoHttp: {
            level: process.env.LOG_LEVEL ?? 'info',
            redact: {
              paths: [...REDACT_PATHS],
              censor: REDACT_CENSOR,
              remove: false,
            },
            serializers: {
              req: (req: { method: string; url: string; headers: Record<string, string | undefined> }) => ({
                method: req.method,
                url: req.url,
                // Intencional: NÃO logar body do request para evitar PII.
                // Handlers específicos podem logar campos selecionados manualmente via safeLog().
                tenantId: req.headers['x-tenant-id'],
              }),
              res: (res: { statusCode: number }) => ({
                statusCode: res.statusCode,
              }),
            },
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname',
                    singleLine: false,
                  },
                }
              : undefined,
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
