'use client';

import { useMockRole } from '@/lib/mock-auth';
import { DashboardOperacionalClient } from './dashboard-operacional-client';

/**
 * Dashboard principal. Renderiza a variação conforme o perfil ativo no
 * `MockAuthProvider`. A troca via user-menu ("Ver como…") causa re-render
 * imediato sem recarregar página.
 */
export default function DashboardPage() {
  const role = useMockRole();
  return <DashboardOperacionalClient role={role} />;
}
