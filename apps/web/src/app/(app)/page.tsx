'use client';

import { DashboardAdmin } from '@/components/dashboard/dashboard-admin';
import { DashboardContabilidade } from '@/components/dashboard/dashboard-contabilidade';
import { DashboardEmpresa } from '@/components/dashboard/dashboard-empresa';
import { useMockRole } from '@/lib/mock-auth';

/**
 * Dashboard principal. Renderiza a variação conforme o perfil ativo no
 * `MockAuthProvider`. A troca via user-menu ("Ver como…") causa re-render
 * imediato sem recarregar página.
 */
export default function DashboardPage() {
  const role = useMockRole();

  if (role === 'admin') return <DashboardAdmin />;
  if (role === 'contabilidade') return <DashboardContabilidade />;
  return <DashboardEmpresa />;
}
