import type * as React from 'react';

export interface HomologationBannerProps {
  /**
   * Quando true, renderiza a barra; quando false, retorna null.
   * Caller (server component) decide com base nas séries ativas da empresa.
   */
  visible: boolean;
}

/**
 * HomologationBanner — barra sticky amarela (Phase 2 Plan 02-06; CERT-07).
 *
 * Renderiza quando a empresa atual tem ao menos uma série em ambiente
 * HOMOLOGACAO ativa. É a defesa #1 de UX contra emissão acidental em
 * produção: o usuário SEMPRE vê o aviso antes de qualquer ação fiscal.
 *
 * Defesa em camadas (T-02-06-04):
 *  - Banner é defesa visual (aqui).
 *  - Backend tem `SeriesService.assertEnvironmentMatch` (CERT-08) que falha
 *    503/403 se a emissão pedir PRODUCAO numa série HOMOLOGACAO ou vice-versa.
 *
 * Acessibilidade:
 *  - role="alert" + aria-live="polite" — leitores de tela anunciam quando
 *    a barra aparece (sem interromper navegação).
 *  - Contraste yellow-400 + yellow-950 atende WCAG AA (≥ 4.5:1).
 *
 * Sticky top-0 z-50 — fica acima de header (z-30) e modais base. Não
 * interfere com Dialog (z-100+) por design.
 */
export function HomologationBanner({
  visible,
}: HomologationBannerProps): React.ReactElement | null {
  if (!visible) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-50 w-full border-b border-yellow-500 bg-yellow-400 px-4 py-2 text-center text-sm text-yellow-950"
    >
      <span className="font-semibold">AMBIENTE DE HOMOLOGAÇÃO</span>
      <span className="ml-2 font-normal">
        — Notas emitidas aqui não têm validade fiscal.
      </span>
    </div>
  );
}
