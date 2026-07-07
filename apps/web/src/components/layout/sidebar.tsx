'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Wallet,
  ShoppingCart,
  Plane,
  Receipt,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  CheckSquare,
  ShieldCheck,
  GitBranch,
  Boxes,
  Package,
  Warehouse,
  Tags,
  MapPin,
  Sparkles,
  Map,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';

const navGroups = [
  {
    label: 'My Work',
    items: [
      { label: 'Dashboard',     href: '/dashboard',     icon: LayoutDashboard, permission: null },
      { label: 'My Approvals',  href: '/approvals',     icon: CheckSquare,     permission: 'notifications.read' },
      { label: 'Notifications', href: '/notifications', icon: Bell,            permission: 'notifications.read' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees',   href: '/employees',   icon: Users,     permission: 'employee.read' },
      { label: 'Departments', href: '/departments', icon: Building2, permission: 'department.manage' },
    ],
  },
  {
    label: 'Time & Leave',
    items: [
      { label: 'Attendance', href: '/attendance', icon: Clock,        permission: 'attendance.viewOwn' },
      { label: 'Leave',      href: '/leave',       icon: CalendarDays,permission: 'leave.apply' },
    ],
  },
  {
    label: 'Money & Requests',
    items: [
      { label: 'Compensation',     href: '/compensation',  icon: Wallet,       permission: 'salary.view' },
      { label: 'Requisitions',     href: '/requisitions',  icon: ShoppingCart, permission: 'requisition.create' },
      { label: 'Travel',           href: '/travel',        icon: Plane,        permission: 'travel.create' },
      { label: 'Expenses',         href: '/expenses',      icon: Receipt,      permission: 'expense.create' },
    ],
  },
  {
    label: 'Assets',
    items: [
      { label: 'Inventory',    href: '/assets',              icon: Warehouse, permission: 'asset.unit.read' },
      { label: 'Distribution', href: '/assets/distribution', icon: Map,       permission: 'asset.unit.read' },
      { label: 'Purchases',    href: '/assets/purchases',    icon: Package,   permission: 'asset.purchase.create' },
      { label: 'Categories',   href: '/assets/categories',   icon: Tags,      permission: 'asset.category.manage' },
      { label: 'Locations',    href: '/assets/locations',    icon: MapPin,    permission: 'asset.location.manage' },
      { label: 'Conditions',   href: '/assets/conditions',   icon: Sparkles,  permission: 'asset.condition.manage' },
      { label: 'Bulk Import',  href: '/assets/import',       icon: Upload,    permission: 'asset.unit.create' },
      { label: 'My Assets',    href: '/assets/my',           icon: Boxes,     permission: null },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Roles',     href: '/settings/roles',     icon: ShieldCheck, permission: 'role.manage' },
      { label: 'Workflows', href: '/settings/workflows', icon: GitBranch,   permission: 'workflow.configure' },
      { label: 'Settings',  href: '/settings',            icon: Settings,    permission: 'settings.manage' },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState(0);

  const canSeeApprovals = hasPermission('notifications.read');

  useEffect(() => {
    if (!user || !canSeeApprovals) return;
    function loadCount() {
      api.get<unknown[]>('/approvals/mine')
        .then((r) => setPendingApprovals(r.length))
        .catch(() => {});
    }
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, [user, canSeeApprovals]);

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.permission === null || hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  // Most-specific-wins active detection so /assets/categories highlights Categories,
  // not Inventory (whose href '/assets' would otherwise also match).
  const allHrefs = visibleGroups.flatMap((g) => g.items.map((i) => i.href));
  function isActive(href: string) {
    if (pathname === href) return true;
    if (!pathname.startsWith(href + '/')) return false;
    return !allHrefs.some(
      (h) => h !== href && h.length > href.length && (pathname === h || pathname.startsWith(h + '/')),
    );
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-border bg-card transition-transform duration-200 motion-reduce:transition-none',
          'lg:static lg:z-auto lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          {!collapsed && (
            <span className="font-display text-base font-semibold text-primary">
              HRM
            </span>
          )}
          {collapsed && (
            <span className="mx-auto hidden font-display text-base font-semibold text-primary lg:block">
              H
            </span>
          )}
          <button
            onClick={onCloseMobile}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              <h2
                className={cn(
                  'mb-1 px-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                  collapsed && 'lg:hidden',
                )}
              >
                {group.label}
              </h2>
              <ul className="space-y-0.5 px-2">
                {group.items.map(({ label, href, icon: Icon }) => {
                  const active = isActive(href);
                  const showBadge = href === '/approvals' && pendingApprovals > 0;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onCloseMobile}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                          active
                            ? 'bg-primary-soft text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          collapsed && 'lg:justify-center lg:px-2',
                        )}
                        title={collapsed ? (showBadge ? `${label} (${pendingApprovals})` : label) : undefined}
                      >
                        <span className="relative shrink-0">
                          <Icon className="h-4 w-4" />
                          {showBadge && (
                            <span
                              className={cn(
                                'absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-danger',
                                !collapsed && 'lg:hidden',
                              )}
                            />
                          )}
                        </span>
                        <span className={cn('flex-1', collapsed && 'lg:hidden')}>{label}</span>
                        {showBadge && (
                          <span
                            className={cn(
                              'flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white',
                              collapsed && 'lg:hidden',
                            )}
                          >
                            {pendingApprovals}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden border-t border-border p-2 lg:block">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-2',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
