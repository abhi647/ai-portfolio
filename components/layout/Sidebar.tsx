'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  AlertTriangle,
  BarChart3,
  PlayCircle,
  FileText,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Signals', href: '/dashboard/signals', icon: TrendingUp },
  { name: 'Portfolio', href: '/dashboard/portfolio', icon: Briefcase },
  { name: 'Risk', href: '/dashboard/risk', icon: AlertTriangle },
  { name: 'Backtest', href: '/backtest', icon: BarChart3 },
  { name: 'Simulate', href: '/simulate', icon: PlayCircle },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="font-semibold">AI Portfolio</span>
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className="rounded-md p-1.5 hover:bg-accent"
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  sidebarCollapsed && 'justify-center'
                )}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          {!sidebarCollapsed ? (
            <div className="rounded-lg bg-muted p-3 text-xs">
              <p className="font-semibold">Offline Mode</p>
              <p className="mt-1 text-muted-foreground">
                All data stored locally
              </p>
            </div>
          ) : (
            <div
              className="flex justify-center text-muted-foreground"
              title="Offline Mode"
            >
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
