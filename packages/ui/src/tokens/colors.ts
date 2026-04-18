/**
 * Tokens de cor Nexo Fiscal expostos como constantes TS.
 * Usar em locais fora do Tailwind (ex: charts, temas de lib externa).
 */
export const brandColors = {
  blue: '#1E5FD8',
  blueDark: '#1748A8',
  blueLight: '#4B83E3',
  green: '#1BA97A',
  greenDark: '#148259',
  greenLight: '#3FC493',
  danger: '#E54848',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

export const statusColors = {
  autorizada: '#1BA97A',
  rejeitada: '#E54848',
  cancelada: '#6B7280',
  pendente: '#F59E0B',
  processando: '#3B82F6',
  rascunho: '#9CA3AF',
} as const;

export type BrandColor = keyof typeof brandColors;
export type StatusColor = keyof typeof statusColors;
