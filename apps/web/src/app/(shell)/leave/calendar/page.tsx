'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

interface TeamLeave {
  id: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  isHalfDay: boolean;
  status: 'pending' | 'approved';
  employee: { id: string; firstName: string; lastName: string };
  leaveType: { name: string; color: string };
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Mon offset for ISO week display
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function TeamCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [leaves, setLeaves] = useState<TeamLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<TeamLeave[]>(`/leave/calendar/team?year=${year}&month=${month}`)
      .then(setLeaves)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfMonth(year, month);
  const today = new Date().toISOString().slice(0, 10);

  function getLeavesForDay(day: number): TeamLeave[] {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter(
      (l) => l.startDate <= dateStr && l.endDate >= dateStr,
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Leave', href: '/leave' }]}
        title="Team Leave Calendar"
        description="Approved and pending leaves for your direct reports"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-36 text-center font-medium text-foreground">
              {monthName} {year}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4 pb-4 overflow-x-auto">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {/* Offset cells */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`offset-${i}`} className="bg-background min-h-[100px]" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayLeaves = getLeavesForDay(day);
                const isToday = dateStr === today;

                return (
                  <div
                    key={day}
                    className={cn(
                      'bg-card min-h-[100px] p-2 transition-colors hover:bg-muted/30',
                      isToday && 'ring-1 ring-inset ring-primary',
                    )}
                  >
                    <div className={cn(
                      'text-xs font-medium mb-1 flex h-6 w-6 items-center justify-center rounded-full',
                      isToday
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground',
                    )}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayLeaves.slice(0, 3).map((leave) => (
                        <div
                          key={leave.id}
                          className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium leading-none"
                          style={{
                            backgroundColor: leave.leaveType.color + '20',
                            color: leave.leaveType.color,
                            opacity: leave.status === 'pending' ? 0.7 : 1,
                          }}
                          title={`${leave.employee.firstName} ${leave.employee.lastName} — ${leave.leaveType.name}${leave.status === 'pending' ? ' (pending)' : ''}`}
                        >
                          <span className="truncate">
                            {leave.employee.firstName[0]}{leave.employee.lastName[0]}
                          </span>
                          {leave.isHalfDay && <span className="opacity-60">½</span>}
                          {leave.status === 'pending' && <span className="opacity-60">?</span>}
                        </div>
                      ))}
                      {dayLeaves.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          +{dayLeaves.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {leaves.length === 0 && !loading && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No team leaves this month</p>
            <p className="text-sm text-muted-foreground">
              Team members&apos; approved and pending leaves will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {leaves.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {[...new Map(leaves.map((l) => [l.leaveType.name, l.leaveType])).values()].map((lt) => (
            <div key={lt.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: lt.color }} />
              {lt.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
