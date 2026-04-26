import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  BusinessException,
  NotFoundResourceException,
} from '../../common/business.exception';
// biome-ignore lint/style/useImportType: NestJS DI exige valor runtime.
import { PrismaService } from '../../db/prisma.service';

/**
 * SeriesNumberingHelper — numeração transacional atômica de séries fiscais.
 *
 * Phase 2 Plan 02-06 (CERT-06). Phase 3 (emissão NF-e/NFS-e) chama
 * `getNextSeqAndIncrement` ANTES de gerar XML — o número devolvido é o que
 * deve ir em `<nNF>` ou equivalente.
 *
 * Mecanismo:
 *  1. SELECT proximo_numero ... FOR UPDATE — lock pessimista na linha da série.
 *  2. UPDATE proximo_numero = proximo_numero + 1 — incremento atômico.
 *  3. COMMIT libera o lock; chamadas concorrentes esperam (sem deadlock — Postgres
 *     resolve via wait queue da row lock).
 *
 * Por que não `serial`/`identity`? Porque numeração fiscal é por série
 * (não global) e precisa ser zerada/avançada por configuração — não dá pra
 * usar sequence Postgres (T-02-06-01).
 *
 * Por que `Serializable` isolation? Garante que mesmo sob race extrema (snapshots
 * paralelos no mesmo instante), Postgres serializa as transações; com `FOR UPDATE`
 * a contenção fica explícita (espera pelo lock) e nenhum gap/dupe é possível.
 *
 * Suporte a transação externa: caller pode passar `tx` para encadear o
 * incremento dentro de uma transação fiscal maior (ex: criar NotaFiscal +
 * incrementar serie no mesmo COMMIT). Sem `tx`, helper cria sua própria.
 */
@Injectable()
export class SeriesNumberingHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomicamente: lê `proximoNumero` (lock pessimista FOR UPDATE) e incrementa.
   * Retorna o número que ESTAVA na série (= o que o chamador deve usar para
   * emitir a próxima NF). Após retorno, próxima chamada retorna N+1.
   *
   * @param serieId UUID da SerieFiscal.
   * @param tx Transaction client opcional. Se passado, helper roda DENTRO dela
   *           (caller controla COMMIT). Se omitido, helper cria sua própria
   *           transação Serializable.
   *
   * @throws NotFoundResourceException Série não existe.
   * @throws BusinessException(SERIE_INACTIVE, 409) Série está inativa.
   */
  async getNextSeqAndIncrement(
    serieId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<bigint> {
    const exec = async (txn: Prisma.TransactionClient): Promise<bigint> => {
      // SELECT FOR UPDATE — lock pessimista da linha da série.
      // Concurrent transactions fazem queue na wait list do Postgres até COMMIT.
      const rows = await txn.$queryRaw<
        Array<{ proximo_numero: bigint; ativa: boolean }>
      >`
        SELECT proximo_numero, ativa
        FROM series_fiscais
        WHERE id = ${serieId}::uuid
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new NotFoundResourceException('serie', serieId);
      }
      const row = rows[0];
      if (!row) {
        throw new NotFoundResourceException('serie', serieId);
      }
      const { proximo_numero, ativa } = row;
      if (!ativa) {
        throw new BusinessException(
          'SERIE_INACTIVE',
          'Série fiscal está inativa — reative-a em Configurações.',
          409,
          { serieId },
        );
      }
      // UPDATE atômico — incrementa proximo_numero.
      await txn.$executeRaw`
        UPDATE series_fiscais
        SET proximo_numero = proximo_numero + 1, updated_at = NOW()
        WHERE id = ${serieId}::uuid
      `;
      return proximo_numero;
    };

    if (tx) return exec(tx);
    return this.prisma.$transaction(exec, {
      isolationLevel: 'Serializable',
    });
  }
}
