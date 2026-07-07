'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, CalendarDays } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { STATUS_STYLES, STATUS_LABELS, STATUS_DOT } from '@/lib/attendance-status';
import { PageHeader } from '@/components/layout/page-header';

interface AttendanceRecord {
  id: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function MyAttendancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<AttendanceRecord | null>(null);
  const [reason, setReason] = useState('');
  const [requestedCheckInAt, setRequestedCheckInAt] = useState('');
  const [requestedCheckOutAt, setRequestedCheckOutAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<AttendanceRecord[]>(`/attendance/me?year=${year}&month=${month}`)
      .then(setRecords)
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
  const todayStr = new Date().toISOString().slice(0, 10);

  function recordForDay(day: number): AttendanceRecord | undefined {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return records.find((r) => r.workDate === dateStr);
  }

  function openDetail(record: AttendanceRecord) {
    setSelected(record);
    setReason('');
    setRequestedCheckInAt(record.checkInAt ? record.checkInAt.slice(0, 16) : '');
    setRequestedCheckOutAt(record.checkOutAt ? record.checkOutAt.slice(0, 16) : '');
    setFormError(null);
  }

  async function submitRegularization() {
    if (!selected) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/attendance/regularizations', {
        attendanceRecordId: selected.id,
        reason,
        requestedCheckInAt: requestedCheckInAt || undefined,
        requestedCheckOutAt: requestedCheckOutAt || undefined,
      });
      setSuccess('Correction request submitted');
      setSelected(null);
    } catch (err: unknown) {
      setFormError((err as ApiError).message ?? 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Attendance', href: '/attendance' }]}
        title="My Attendance"
        description="Your daily attendance status for the month"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="w-36 text-center font-medium text-foreground">{monthName} {year}</span>
            <Button variant="outline" size="sm" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {success && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-4 text-sm text-success">{success}</CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No attendance recorded yet this month</p>
            <p className="text-sm text-muted-foreground">Clock in from the Attendance hub to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 pb-4 overflow-x-auto">
            <div className="grid grid-cols-7 gap-px mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`offset-${i}`} className="bg-background min-h-[90px]" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const record = recordForDay(day);
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!record}
                    onClick={() => record && openDetail(record)}
                    className={cn(
                      'bg-card min-h-[90px] p-2 text-left transition-colors hover:bg-muted/30 disabled:cursor-default disabled:hover:bg-card',
                      isToday && 'ring-1 ring-inset ring-primary',
                    )}
                  >
                    <div className={cn(
                      'text-xs font-medium mb-1 flex h-6 w-6 items-center justify-center rounded-full',
                      isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                    )}>
                      {day}
                    </div>
                    {record && (
                      <div className="flex items-center gap-1">
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[record.status] ?? 'bg-muted-foreground/40')} />
                        <span className="text-[11px] text-muted-foreground truncate">
                          {STATUS_LABELS[record.status] ?? record.status}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{new Date(selected.workDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</DialogTitle>
              </DialogHeader>

              <div className={cn('inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[selected.status] ?? '')}>
                {STATUS_LABELS[selected.status] ?? selected.status}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Check-in</p>
                  <p className="tabular-nums text-foreground">
                    {selected.checkInAt ? new Date(selected.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Check-out</p>
                  <p className="tabular-nums text-foreground">
                    {selected.checkOutAt ? new Date(selected.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
                {selected.lateMinutes > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Late by</p>
                    <p className="tabular-nums text-warning">{selected.lateMinutes} min</p>
                  </div>
                )}
                {selected.workedMinutes > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Worked</p>
                    <p className="tabular-nums text-foreground">{Math.round(selected.workedMinutes / 60 * 10) / 10} hrs</p>
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Request a correction</p>
                {formError && <p className="text-sm text-danger">{formError}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reqIn">Correct check-in</Label>
                    <Input id="reqIn" type="datetime-local" value={requestedCheckInAt} onChange={(e) => setRequestedCheckInAt(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reqOut">Correct check-out</Label>
                    <Input id="reqOut" type="datetime-local" value={requestedCheckOutAt} onChange={(e) => setRequestedCheckOutAt(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reason">Reason <span className="text-danger">*</span></Label>
                  <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what happened…" rows={3} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
                <Button onClick={submitRegularization} disabled={submitting || !reason.trim()}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Submit request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
