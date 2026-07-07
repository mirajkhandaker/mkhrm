'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  Loader2,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  year: number;
  entitled: number;
  accrued: number;
  used: number;
  pending: number;
  available: number;
  leaveType: { name: string; color: string; isPaid: boolean };
}

interface LeaveApplication {
  id: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  isHalfDay: boolean;
  reason: string | null;
  status: string;
  leaveType: { name: string; color: string };
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'border-warning text-warning bg-warning/5',
  approved:  'border-success text-success bg-success/5',
  rejected:  'border-danger text-danger bg-danger/5',
  cancelled: 'border-border text-muted-foreground',
  draft:     'border-border text-muted-foreground',
};

const STATUS_ICON: Record<string, React.FC<{ className?: string }>> = {
  approved:  CheckCircle,
  rejected:  XCircle,
  pending:   Clock,
  cancelled: XCircle,
};

export default function LeavePage() {
  const { hasPermission } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const year = new Date().getFullYear();

  const load = useCallback(() => {
    Promise.all([
      api.get<LeaveBalance[]>(`/leave/balances?year=${year}`),
      api.get<LeaveApplication[]>('/leave/applications'),
    ])
      .then(([b, a]) => { setBalances(b); setApplications(a); })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id: string) {
    if (!confirm('Cancel this leave application? This cannot be undone.')) return;
    setCancellingId(id);
    setError(null);
    try {
      await api.delete(`/leave/applications/${id}`);
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">My Leave</h1>
          <p className="text-sm text-muted-foreground">Balances and applications for {year}</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('leave.manage') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave/admin">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Leave Types & Policies
              </Link>
            </Button>
          )}
          {hasPermission('leave.approve') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave/calendar">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Team Calendar
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/leave/apply">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Apply for Leave
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {/* Balance Cards */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Balances
        </h2>
        {balances.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <RefreshCw className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No leave balances found. Contact HR to initialise your balances.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {balances.map((b) => (
              <Card key={b.id} className="overflow-hidden">
                <div className="h-1" style={{ backgroundColor: b.leaveType.color }} />
                <CardContent className="pt-4 pb-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">{b.leaveType.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.leaveType.isPaid ? 'Paid' : 'Unpaid'}
                      </p>
                    </div>
                    <span
                      className="text-2xl font-semibold tabular-nums"
                      style={{ color: b.leaveType.color }}
                    >
                      {Number(b.available).toFixed(1)}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Entitled</span>
                      <span className="tabular-nums">{Number(b.entitled).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Used</span>
                      <span className="tabular-nums text-danger">{Number(b.used).toFixed(1)}</span>
                    </div>
                    {Number(b.pending) > 0 && (
                      <div className="flex justify-between">
                        <span>Pending</span>
                        <span className="tabular-nums text-warning">{Number(b.pending).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Application History */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Applications
        </h2>
        {applications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="font-medium text-foreground">No leave applications yet</p>
              <p className="text-sm text-muted-foreground">When you apply for leave, your history will appear here.</p>
              <Button size="sm" asChild className="mt-1">
                <Link href="/leave/apply">Apply for Leave</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {applications.map((app) => {
              const Icon = STATUS_ICON[app.status] ?? Clock;
              const canCancel = ['draft', 'pending'].includes(app.status);
              return (
                <Card key={app.id} className="flex items-center gap-4 px-5 py-3">
                  <div
                    className="h-10 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: app.leaveType.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{app.leaveType.name}</span>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', STATUS_STYLES[app.status] ?? '')}
                      >
                        {app.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(app.startDate).toLocaleDateString()} –{' '}
                      {new Date(app.endDate).toLocaleDateString()}
                      {app.isHalfDay && ' (half day)'}
                      {' · '}
                      {Number(app.daysCount).toFixed(1)} {Number(app.daysCount) === 1 ? 'day' : 'days'}
                      {app.reason && ` · ${app.reason.slice(0, 60)}${app.reason.length > 60 ? '…' : ''}`}
                    </p>
                  </div>
                  {canCancel && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-danger hover:bg-danger/10 hover:text-danger flex-shrink-0"
                      disabled={cancellingId === app.id}
                      onClick={() => handleCancel(app.id)}
                      aria-label="Cancel leave application"
                    >
                      {cancellingId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Icon
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      app.status === 'approved' ? 'text-success' :
                      app.status === 'rejected' ? 'text-danger' :
                      'text-warning',
                    )}
                  />
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
