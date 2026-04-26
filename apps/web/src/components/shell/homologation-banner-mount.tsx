import { HomologationBanner } from '@nexo/ui';
import { ApiError, fetchApi } from '@/lib/api-client';

/**
 * HomologationBannerMount — server component (Phase 2 Plan 02-06; CERT-07).
 *
 * Faz fetch das séries ativas da empresa atual via `/api/series` e decide
 * se renderiza o banner amarelo. Critério: AO MENOS UMA série está ativa
 * em ambiente HOMOLOGACAO.
 *
 * Defaults safe (T-02-06-04):
 *  - Falha do fetch (rede, 401, 5xx) → `visible=false`. NÃO mostra banner.
 *    Banner é apenas defesa de UX; o guard real (assertEnvironmentMatch
 *    no backend, CERT-08) impede emissão errada server-side mesmo sem banner.
 *  - Empresa sem série cadastrada → `visible=false` (sem séries, sem emissão
 *    possível, banner irrelevante).
 *  - Apenas séries em PRODUCAO → `visible=false` (esperado).
 *
 * Performance:
 *  - Fetch é server-side, cache 'no-store' (api-client default). Roda 1x por
 *    request do shell — aceita o overhead pelo valor de segurança.
 *  - Em modo protótipo (USE_PROTOTYPE_AUTH=true), fetchApi pode lançar; o
 *    catch silencia e renderiza vazio.
 */

interface SerieResponseItem {
  id: string;
  empresaId: string;
  modelo: string;
  serie: number;
  proximoNumero: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  ativa: boolean;
}

export async function HomologationBannerMount(): Promise<React.ReactElement> {
  let visible = false;
  try {
    const series = await fetchApi<SerieResponseItem[]>('/api/series');
    if (Array.isArray(series)) {
      visible = series.some(
        (s) => s.ativa && s.ambiente === 'HOMOLOGACAO',
      );
    }
  } catch (err) {
    // Falha silenciosa — não mostra banner se API falhar. Default safe (T-02-06-04).
    // Em modo protótipo (Plan 02-09 não rodou ainda) ou Clerk indisponível,
    // fetchApi lança ApiError; capturamos aqui sem propagar.
    if (!(err instanceof ApiError)) {
      // Erros inesperados não-API ainda são engolidos para não quebrar shell —
      // banner é cosmético no fluxo do layout autenticado.
    }
    visible = false;
  }
  return <HomologationBanner visible={visible} />;
}
