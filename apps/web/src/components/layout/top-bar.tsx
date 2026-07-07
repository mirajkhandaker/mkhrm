'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Sun, Moon, LogOut, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    function loadCount() {
      api.get<{ count: number }>('/notifications/unread-count')
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});
    }
    loadCount();
    const interval = setInterval(loadCount, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search…"
          className={cn(
            'h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {mounted ? (
            theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
          ) : (
            <div className="h-4 w-4" aria-hidden />
          )}
        </button>

        <button
          onClick={() => router.push('/notifications')}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" />
          )}
        </button>

        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground select-none">
          {user?.email?.[0]?.toUpperCase() ?? '?'}
        </div>

        <button
          onClick={logout}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
