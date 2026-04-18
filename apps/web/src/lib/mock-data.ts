/**
 * Mock data para desenvolvimento do shell visual.
 *
 * Plan 07 (Clerk + API) substitui este módulo por queries reais via
 * React Server Components / Server Actions. Os tipos exportados aqui servem
 * de contrato temporário consumido pelos componentes `shell/*`.
 */

export interface MockEmpresa {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ambiente: 'producao' | 'homologacao';
}

export const mockEmpresas: MockEmpresa[] = [
  {
    id: 'e-1',
    razaoSocial: 'Empresa A LTDA',
    cnpj: '11.222.333/0001-81',
    ambiente: 'producao',
  },
  {
    id: 'e-2',
    razaoSocial: 'Empresa B S/A',
    cnpj: '44.555.666/0001-99',
    ambiente: 'homologacao',
  },
  {
    id: 'e-3',
    razaoSocial: 'Comércio Central LTDA',
    cnpj: '77.888.999/0001-00',
    ambiente: 'producao',
  },
];

export const mockUser = {
  name: 'Usuário Teste',
  email: 'teste@nexofiscal.local',
  avatarUrl: null as string | null,
};

export type NotificationSeverity = 'critical' | 'warning' | 'info';

export interface MockNotification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  time: string;
}

export const mockNotifications: {
  criticalCount: number;
  items: MockNotification[];
} = {
  criticalCount: 3,
  items: [
    {
      id: 'n-1',
      severity: 'critical',
      title: 'Certificado vence em 3 dias',
      time: 'há 2h',
    },
    {
      id: 'n-2',
      severity: 'warning',
      title: 'Nota rejeitada — código 611',
      time: 'há 15min',
    },
    {
      id: 'n-3',
      severity: 'info',
      title: 'Importação de 12 XMLs concluída',
      time: 'há 1h',
    },
  ],
};
