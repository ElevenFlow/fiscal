import {
  Bell,
  FilePlus,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Estrutura de navegação hierárquica.
 *
 * Plan 07 (Clerk + RBAC) vai filtrar seções/itens por perfil
 * (admin plataforma / contabilidade / empresa). Por enquanto, todas visíveis
 * para validar layout e paleta no checkpoint visual.
 */
export const navItems: NavSection[] = [
  {
    id: 'overview',
    label: 'Visão geral',
    items: [{ id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard }],
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    items: [
      { id: 'emitir', label: 'Emitir nota', href: '/emitir', icon: FilePlus },
      { id: 'documentos', label: 'Documentos', href: '/documentos', icon: FileText },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    items: [
      { id: 'cadastros', label: 'Cadastros', href: '/cadastros', icon: Users },
      { id: 'estoque', label: 'Estoque', href: '/estoque', icon: Warehouse },
      { id: 'importar', label: 'Importar XML', href: '/importar', icon: ShoppingBag },
    ],
  },
  {
    id: 'monitoramento',
    label: 'Monitoramento',
    items: [
      { id: 'alertas', label: 'Alertas', href: '/alertas', icon: Bell, badge: 3 },
      { id: 'auditoria', label: 'Auditoria', href: '/auditoria', icon: ShieldCheck },
    ],
  },
  {
    id: 'config',
    label: 'Configurações',
    items: [
      { id: 'usuarios', label: 'Usuários', href: '/usuarios', icon: UserCog },
      { id: 'config', label: 'Configurações', href: '/config', icon: Settings },
    ],
  },
];
