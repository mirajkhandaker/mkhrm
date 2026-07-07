'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Users, Download } from 'lucide-react';
import { api, ApiError, downloadFile } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { STATUS_DOT, STATUS_LABELS } from '@/lib/attendance-status';
import { PageHeader } from '@/components/layout/page-header';

interface AttendanceRecord {
  id: string;
  workDate: string;
  status: string;
  employee: { id: string; firstName: string; lastName: string };
}

interface Department {
  id: string;
  name: string;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - day);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function TeamAttendancePage() {
  const { hasPermission } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const from = toDateStr(days[0]);
  const to = toDateStr(days[6]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadFile(`/reports/export/attendance?from=${from}&to=${to}&format=xlsx`, `attendance-${from}-to-${to}.xlsx`);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to export');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!hasPermission('attendance.viewAll')) return;
    api.get<Department[]>('/departments').then(setDepartments).catch(() => {});
  }, [hasPermission]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from, to });
    if (departmentId) params.set('departmentId', departmentId);
    api.get<AttendanceRecord[]>(`/attendance/team?${params}`)
      .then((data) => {
        setRecords(data);
        const uniq = new Map(data.map((r) => [r.employee.id, r.employee]));
        setEmployees([...uniq.values()]);
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, departmentId]);

  useEffect(() => { load(); }, [load]);

  function recordFor(employeeId: string, dateStr: string) {
    return records.find((r) => r.employee.id === employeeId && r.workDate === dateStr);
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Attendance', href: '/attendance' }]}
        title="Team Attendance"
        description="Daily status for your team, week at a glance"
        actions={
          <div className="flex items-center gap-2">
            {hasPermission('reports.view') && (
              <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                Export
              </Button>
            )}
            {hasPermission('attendance.viewAll') && (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="flex h-9 rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">My direct reports</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="whitespace-nowrap text-center text-sm font-medium text-foreground">
              {days[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
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
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No team attendance to show</p>
            <p className="text-sm text-muted-foreground">
              {departmentId ? 'No records for this department this week.' : 'You have no direct reports, or no records exist yet this week.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-card">Employee</th>
                  {days.map((d) => (
                    <th key={toDateStr(d)} className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {d.toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap sticky left-0 bg-card">
                      {emp.firstName} {emp.lastName}
                    </td>
                    {days.map((d) => {
                      const dateStr = toDateStr(d);
                      const record = recordFor(emp.id, dateStr);
                      return (
                        <td key={dateStr} className="px-3 py-3 text-center">
                          {record ? (
                            <span
                              className={cn('inline-block h-2.5 w-2.5 rounded-full', STATUS_DOT[record.status] ?? 'bg-muted-foreground/40')}
                              title={STATUS_LABELS[record.status] ?? record.status}
                            />
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
