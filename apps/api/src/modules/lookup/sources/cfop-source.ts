import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { resolveFixturePath } from './fixture-resolver';

export interface CfopEntry {
  codigo: string;
  descricao: string;
  tipo: 'entrada' | 'saida';
}

/**
 * CfopSource — busca catálogo CFOP (Código Fiscal de Operações e Prestações).
 *
 * CFOP é estável (raramente muda — definido no Convênio SINIEF S/N de 1970,
 * com atualizações pontuais). A fixture commitada cobre 99% dos casos PME.
 * URL BrasilAPI (`/api/cfop/v1`) é incerta — tratamos como fixture-only por
 * padrão, com fallback para fixture mesmo em PROD.
 *
 * Threat model:
 *  - T-02-08-04: fixture sempre disponível.
 */
@Injectable()
export class CfopSource {
  private readonly logger = new Logger(CfopSource.name);

  async fetch(): Promise<CfopEntry[]> {
    this.logger.log('CFOP: usando fixture local (lista estável SINIEF)');
    return this.loadFixture();
  }

  private loadFixture(): CfopEntry[] {
    return JSON.parse(
      readFileSync(resolveFixturePath('cfop-bootstrap.json'), 'utf-8'),
    ) as CfopEntry[];
  }
}
