'use client';

import { navItems } from '@/lib/nav-items';
import {
  Badge,
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  cn,
} from '@nexo/ui';
import { ChevronsLeft, ChevronsRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSidebarCollapsed } from './sidebar-state';

/**
 * Sidebar colapsável (240px → 64px) em desktop; drawer via Sheet em mobile.
 *
 * - FOUND-14: colapsa/expande com persistência em localStorage.
 * - FOUND-16: em viewport < 768px vira drawer acionado por MobileSidebarTrigger.
 */

function NavContent({
  isCollapsed,
  onItemClick,
}: {
  isCollapsed: boolean;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Logo area */}
      <div
        className={cn('flex h-16 items-center border-b px-4', isCollapsed && 'justify-center px-2')}
      >
        {!isCollapsed ? (
          <span className="text-lg font-bold text-brand-blue">Nexo Fiscal</span>
        ) : (
          <span className="text-xl font-bold text-brand-blue">N</span>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navItems.map((section, idx) => (
          <div key={section.id} className={idx > 0 ? 'mt-6' : ''}>
            {!isCollapsed && (
              <div className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
            )}
            <ul className="space-y-1 px-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onItemClick}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive &&
                          'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                        isCollapsed && 'justify-center px-2',
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.badge ? (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                              {item.badge}
                            </Badge>
                          ) : null}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        'hidden flex-col border-r bg-card transition-[width] duration-200 ease-in-out md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <NavContent isCollapsed={collapsed} />
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('w-full justify-start', collapsed && 'justify-center')}
          title={collapsed ? 'Expandir' : 'Recolher'}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">Recolher</span>}
        </Button>
      </div>
    </aside>
  );
}

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
        <div className="flex h-full flex-col">
          <NavContent isCollapsed={false} onItemClick={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
