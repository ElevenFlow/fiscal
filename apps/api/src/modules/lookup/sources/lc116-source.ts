import { readFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { resolveFixturePath } from './fixture-resolver';

export interface Lc116Entry {
  codigo: string;
  descricao: string;
}

/**
 * Lc116Source — busca catálogo de serviços da LC 116/2003 (anexo).
 *
 * LC 116/2003 é lei estática (raramente alterada — última revisão LC 175/2020).
 * Fixture commitada cobre 100% — fonte primária e única. Sync mensal só
 * re-aplica para garantir que tabela existe / é re-populada se truncada.
 *
 * Threat model:
 *  - T-02-08-04: fixture sempre disponível.
 */
@Injectable()
export class Lc116Source {
  private readonly logger = new Logger(Lc116Source.name);

  async fetch(): Promise<Lc116Entry[]> {
    this.logger.log('LC116: usando fixture local (lei estática)');
    return this.loadFixture();
  }

  private loadFixture(): Lc116Entry[] {
    return JSON.parse(
      readFileSync(resolveFixturePath('lc116-bootstrap.json'), 'utf-8'),
    ) as Lc116Entry[];
  }
}
