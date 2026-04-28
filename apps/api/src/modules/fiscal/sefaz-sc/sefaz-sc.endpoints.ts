export type SefazScServico =
  | 'statusServico'
  | 'autorizacao'
  | 'retAutorizacao'
  | 'consultaProtocolo'
  | 'recepcaoEvento';

export type SefazScAmbiente = 'HOMOLOGACAO' | 'PRODUCAO';

export const SEFAZ_SC_UF_CODE = '42';

export const SEFAZ_SC_ENDPOINTS: Record<
  SefazScAmbiente,
  Record<SefazScServico, string>
> = {
  HOMOLOGACAO: {
    statusServico:
      'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    autorizacao:
      'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao:
      'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consultaProtocolo:
      'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    recepcaoEvento:
      'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
  PRODUCAO: {
    statusServico: 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    autorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    retAutorizacao: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    consultaProtocolo: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    recepcaoEvento: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
  },
};
