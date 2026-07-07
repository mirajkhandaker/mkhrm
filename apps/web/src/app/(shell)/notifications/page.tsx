'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wallet,
  Info,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  approval_requested: Bell,
  approval_approved: CheckCircle,
  approval_rejected: XCircle,
  leave_approved: CheckCircle,
  leave_rejected: XCircle,
  expense_reimbursed: Wallet,
  system: Info,
};

const TYPE_COLOR: Record<string, string> = {
  approval_requested: 'text-info',
  approval_approved: 'text-success',
  approval_rejected: 'text-danger',
  leave_approved: 'text-success',
  leave_rejected: 'text-danger',
  expense_reimbursed: 'text-info',
  system: 'text-warning',
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  function load() {
    setLoading(true);
    api.get<Notification[]>('/notifications')
      .then(setNotifications)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleClick(n: Notification) {
    if (!n.isRead) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to mark all as read');
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" disabled={markingAll} onClick={handleMarkAllRead}>
              {markingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              )}
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ll see updates here when requests are submitted, approved, or need your attention.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Info;
            return (
              <Card
                key={n.id}
                role={n.link ? 'button' : undefined}
                onClick={() => handleClick(n)}
                className={cn(
                  'flex items-start gap-3 px-5 py-3 transition-colors',
                  n.link && 'cursor-pointer hover:bg-muted/30',
                  !n.isRead && 'bg-primary-soft/40',
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', TYPE_COLOR[n.type] ?? 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm', n.isRead ? 'text-foreground' : 'font-semibold text-foreground')}>
                      {n.title}
                    </span>
                    {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
