import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { resolveFixturePath } from './fixture-resolver';

export interface NcmEntry {
  codigo: string;
  descricao: string;
}

/**
 * NcmSource — busca catálogo NCM (Nomenclatura Comum do Mercosul).
 *
 * Fonte primária: BrasilAPI proxy `https://brasilapi.com.br/api/ncm/v1`
 * (consolida lista oficial Receita Federal). Em test/dev sem rede, usa
 * fixture commitada em apps/api/prisma/fixtures/ncm-bootstrap.json.
 *
 * Threat model:
 *  - T-02-08-01 (SSRF): URL hardcoded com guard `startsWith('https://brasilapi.com.br/')`.
 *  - T-02-08-04 (timeout/upstream lento): AbortSignal.timeout 30s — falha
 *    em uma source não bloqueia o sync das outras (LookupSyncService.syncAll).
 *  - T-02-08-05 (payload malicioso): filtra códigos não-numéricos (regex /^\d{8}$/)
 *    e sanitiza descrição (preserva apenas codigo + descricao do payload).
 */
@Injectable()
export class NcmSource {
  private readonly logger = new Logger(NcmSource.name);
  private readonly TIMEOUT_MS = 30_000;
  private readonly URL = 'https://brasilapi.com.br/api/ncm/v1';
  private readonly ALLOWED_HOST_PREFIX = 'https://brasilapi.com.br/';

  async fetch(): Promise<NcmEntry[]> {
    if (this.shouldUseFixture()) {
      this.logger.log('NCM: usando fixture local (NODE_ENV=test ou LOOKUP_USE_FIXTURE=true)');
      return this.loadFixture();
    }
    if (!this.URL.startsWith(this.ALLOWED_HOST_PREFIX)) {
      throw new Error('SSRF guard: NCM URL hardcoded foi modificada para host não permitido');
    }

    let response: Response;
    try {
      response = await fetch(this.URL, {
        signal: AbortSignal.timeout(this.TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      throw new Error(`NCM fetch falhou: ${(err as Error).message}`);
    }
    if (!response.ok) {
      throw new Error(`NCM upstream HTTP ${response.status}`);
    }

    const data = (await response.json()) as Array<{ codigo?: string; descricao?: string }>;
    if (!Array.isArray(data)) {
      throw new Error('NCM upstream retornou payload não-array');
    }
    return data
      .filter(
        (d): d is { codigo: string; descricao: string } =>
          typeof d.codigo === 'string' &&
          typeof d.descricao === 'string' &&
          /^\d{8}$/.test(d.codigo),
      )
      .map((d) => ({ codigo: d.codigo, descricao: d.descricao }));
  }

  private shouldUseFixture(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.LOOKUP_USE_FIXTURE === 'true';
  }

  private loadFixture(): NcmEntry[] {
    return JSON.parse(
      readFileSync(resolveFixturePath('ncm-bootstrap.json'), 'utf-8'),
    ) as NcmEntry[];
  }
}
