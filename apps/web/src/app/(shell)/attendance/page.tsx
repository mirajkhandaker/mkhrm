'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  LogIn,
  LogOut,
  Loader2,
  CalendarDays,
  Users,
  Settings2,
  CalendarClock,
  PartyPopper,
  Upload,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { STATUS_STYLES, STATUS_LABELS } from '@/lib/attendance-status';

interface AttendanceRecord {
  id: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  lateMinutes: number;
  workedMinutes: number;
}

export default function AttendanceHubPage() {
  const { hasPermission } = useAuth();
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<AttendanceRecord[]>(`/attendance/me?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .then((records) => setToday(records.find((r) => r.workDate === todayStr) ?? null))
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClockIn() {
    setActing(true);
    setError(null);
    try {
      await api.post('/attendance/clock-in');
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to clock in');
    } finally {
      setActing(false);
    }
  }

  async function handleClockOut() {
    setActing(true);
    setError(null);
    try {
      await api.post('/attendance/clock-out');
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to clock out');
    } finally {
      setActing(false);
    }
  }

  const clockedIn = !!today?.checkInAt && !today?.checkOutAt;
  const clockedOut = !!today?.checkInAt && !!today?.checkOutAt;

  const linkGroups = [
    {
      label: 'View',
      links: [
        { label: 'My Attendance', description: 'Your month calendar, statuses and worked hours.', href: '/attendance/my-attendance', icon: CalendarDays, permission: 'attendance.viewOwn' },
        { label: 'Team Attendance', description: 'See your direct reports’ attendance by day.', href: '/attendance/team', icon: Users, permission: null },
      ],
    },
    {
      label: 'Scheduling & Data (Admin)',
      links: [
        { label: 'Shifts', description: 'Define fixed or roster-based work patterns.', href: '/attendance/shifts', icon: Settings2, permission: 'attendance.manageShift' },
        { label: 'Rosters', description: 'Assign shifts to a team across a date range.', href: '/attendance/rosters', icon: CalendarClock, permission: 'attendance.manageRoster' },
        { label: 'Holidays', description: 'Company and government holidays that block scheduling.', href: '/attendance/holidays', icon: PartyPopper, permission: 'attendance.manageHoliday' },
        { label: 'Import Attendance', description: 'Upload a device export to bulk-load punch records.', href: '/attendance/import', icon: Upload, permission: 'import.upload' },
      ],
    },
  ]
    .map((group) => ({ ...group, links: group.links.filter((l) => l.permission === null || hasPermission(l.permission)) }))
    .filter((group) => group.links.length > 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">Clock in and out, and manage schedules</p>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <Clock className="h-8 w-8 text-primary" />
          <div>
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-sm text-muted-foreground">
              {now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {today && (
            <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[today.status] ?? '')}>
              {STATUS_LABELS[today.status] ?? today.status}
              {today.lateMinutes > 0 && ` · ${today.lateMinutes} min late`}
            </Badge>
          )}

          {today?.checkInAt && (
            <p className="text-xs text-muted-foreground">
              In: {new Date(today.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {today.checkOutAt && ` · Out: ${new Date(today.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          )}

          {hasPermission('attendance.clockIn') && !clockedOut && (
            <Button onClick={clockedIn ? handleClockOut : handleClockIn} disabled={acting} size="lg">
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : clockedIn ? (
                <LogOut className="h-4 w-4 mr-1.5" />
              ) : (
                <LogIn className="h-4 w-4 mr-1.5" />
              )}
              {clockedIn ? 'Clock Out' : 'Clock In'}
            </Button>
          )}

          {clockedOut && (
            <p className="text-xs text-muted-foreground">You&apos;ve completed your shift for today.</p>
          )}
        </CardContent>
      </Card>

      {linkGroups.map((group) => (
        <div key={group.label} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.links.map(({ label, description, href, icon: Icon }) => (
              <Link key={href} href={href}>
                <Card className="h-full transition-colors hover:border-primary hover:bg-primary-soft/30">
                  <CardContent className="flex items-start gap-3 py-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
