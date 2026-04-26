import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { resolveFixturePath } from './fixture-resolver';

export interface CestEntry {
  codigo: string;
  descricao: string;
  ncmRelacionado?: string | null;
}

/**
 * CestSource — busca catálogo CEST (Convênio CONFAZ 92/2015).
 *
 * Fonte oficial é HTML do CONFAZ — não é estável para parse automatizado.
 * Estratégia: usar fixture commitada como fonte primária; URL upstream
 * opcional (não definida hoje). Sync mensal apenas re-aplica a fixture
 * + atualizações manuais via PR (curadoria backoffice).
 *
 * Threat model:
 *  - T-02-08-04: fixture sempre disponível — sem rede, sem falha.
 */
@Injectable()
export class CestSource {
  private readonly logger = new Logger(CestSource.name);

  async fetch(): Promise<CestEntry[]> {
    // CEST não tem fonte oficial em JSON — sempre fixture (curadoria backoffice
    // via PR). Em prod, futuramente podemos plugar BrasilAPI ou scraping HTML
    // do CONFAZ; por ora a fixture é a fonte de verdade.
    this.logger.log('CEST: usando fixture local (fonte primária — CONFAZ não expõe JSON oficial)');
    return this.loadFixture();
  }

  private loadFixture(): CestEntry[] {
    return JSON.parse(
      readFileSync(resolveFixturePath('cest-bootstrap.json'), 'utf-8'),
    ) as CestEntry[];
  }
}
