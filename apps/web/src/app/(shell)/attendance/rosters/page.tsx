'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, CheckCircle, CalendarClock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';

interface Roster {
  id: string;
  name: string;
  cycleDays: number;
  department: { id: string; name: string } | null;
}

interface Shift {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface RosterAssignment {
  id: string;
  workDate: string;
  employee: { id: string; firstName: string; lastName: string };
  shift: { id: string; name: string };
}

interface Department {
  id: string;
  name: string;
}

const NEW_ROSTER_DEFAULT = { name: '', departmentId: '', cycleDays: 7 };

export default function RostersPage() {
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showNewRoster, setShowNewRoster] = useState(false);
  const [newRoster, setNewRoster] = useState({ ...NEW_ROSTER_DEFAULT });
  const [creatingRoster, setCreatingRoster] = useState(false);

  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<RosterAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [cellShifts, setCellShifts] = useState<Record<string, string>>({}); // key: `${employeeId}:${cycleDay}`
  const [startDate, setStartDate] = useState('');
  const [repeatCycles, setRepeatCycles] = useState(4);
  const [applying, setApplying] = useState(false);

  const selectedRoster = rosters.find((r) => r.id === selectedRosterId) ?? null;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Roster[]>('/attendance/rosters'),
      api.get<Shift[]>('/attendance/shifts'),
      api.get<Department[]>('/departments'),
      api.get<{ data: Employee[] }>('/employees?limit=200'),
    ])
      .then(([r, s, d, e]) => { setRosters(r); setShifts(s); setDepartments(d); setEmployees(e.data); })
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadAssignments = useCallback((rosterId: string) => {
    setAssignmentsLoading(true);
    api.get<RosterAssignment[]>(`/attendance/rosters/${rosterId}/assignments`)
      .then(setAssignments)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setAssignmentsLoading(false));
  }, []);

  function selectRoster(id: string) {
    setSelectedRosterId(id);
    setSelectedEmployeeIds([]);
    setCellShifts({});
    loadAssignments(id);
  }

  async function handleCreateRoster(e: React.FormEvent) {
    e.preventDefault();
    setCreatingRoster(true);
    setError(null);
    try {
      const created = await api.post<Roster>('/attendance/rosters', {
        name: newRoster.name,
        departmentId: newRoster.departmentId || undefined,
        cycleDays: newRoster.cycleDays,
      });
      setSuccess('Roster created');
      setShowNewRoster(false);
      setNewRoster({ ...NEW_ROSTER_DEFAULT });
      setLoading(true);
      load();
      selectRoster(created.id);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to create roster');
    } finally {
      setCreatingRoster(false);
    }
  }

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function handleApply() {
    if (!selectedRoster || !startDate) return;
    setApplying(true);
    setError(null);
    try {
      const cycleDays = selectedRoster.cycleDays;
      const start = new Date(startDate);
      const assignmentsToSubmit: Array<{ employeeId: string; shiftId: string; workDate: string }> = [];

      for (let cycle = 0; cycle < repeatCycles; cycle++) {
        for (let day = 1; day <= cycleDays; day++) {
          const date = new Date(start);
          date.setDate(date.getDate() + cycle * cycleDays + (day - 1));
          const workDate = date.toISOString().slice(0, 10);

          for (const empId of selectedEmployeeIds) {
            const shiftId = cellShifts[`${empId}:${day}`];
            if (!shiftId) continue;
            assignmentsToSubmit.push({ employeeId: empId, shiftId, workDate });
          }
        }
      }

      if (assignmentsToSubmit.length === 0) {
        setError('Pick at least one employee and assign a shift to at least one cycle day');
        return;
      }

      await api.post(`/attendance/rosters/${selectedRoster.id}/assignments`, { assignments: assignmentsToSubmit });
      setSuccess(`Applied ${assignmentsToSubmit.length} shift assignments`);
      loadAssignments(selectedRoster.id);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to apply roster assignments');
    } finally {
      setApplying(false);
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
      <PageHeader
        breadcrumb={[{ label: 'Attendance', href: '/attendance' }]}
        title="Rosters"
        description="Build rotating shift patterns for a team"
        actions={
          <Button size="sm" onClick={() => setShowNewRoster((v) => !v)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Roster
          </Button>
        }
      />

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}
      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {showNewRoster && (
        <Card>
          <CardHeader><CardTitle>New Roster</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRoster} className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="rname">Name <span className="text-danger">*</span></Label>
                <Input id="rname" value={newRoster.name} onChange={(e) => setNewRoster((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rdept">Department</Label>
                <select
                  id="rdept"
                  value={newRoster.departmentId}
                  onChange={(e) => setNewRoster((f) => ({ ...f, departmentId: e.target.value }))}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rcycle">Cycle days</Label>
                <Input id="rcycle" type="number" min={1} value={newRoster.cycleDays} onChange={(e) => setNewRoster((f) => ({ ...f, cycleDays: Number(e.target.value) }))} />
              </div>
              <div className="flex gap-3 sm:col-span-3">
                <Button type="submit" disabled={creatingRoster}>
                  {creatingRoster && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  Create Roster
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowNewRoster(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {rosters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No rosters yet</p>
            <p className="text-sm text-muted-foreground">Create a roster to start assigning rotating shifts.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rosters.map((r) => (
            <Button
              key={r.id}
              variant={r.id === selectedRosterId ? 'default' : 'outline'}
              size="sm"
              onClick={() => selectRoster(r.id)}
            >
              {r.name} · {r.cycleDays}d
            </Button>
          ))}
        </div>
      )}

      {selectedRoster && (
        <Card>
          <CardHeader>
            <CardTitle>Build: {selectedRoster.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Employees</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => toggleEmployee(emp.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedEmployeeIds.includes(emp.id)
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {emp.firstName} {emp.lastName}
                  </button>
                ))}
              </div>
            </div>

            {selectedEmployeeIds.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Employee</th>
                      {Array.from({ length: selectedRoster.cycleDays }, (_, i) => i + 1).map((day) => (
                        <th key={day} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Day {day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeeIds.map((empId) => {
                      const emp = employees.find((e) => e.id === empId);
                      return (
                        <tr key={empId} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{emp?.firstName} {emp?.lastName}</td>
                          {Array.from({ length: selectedRoster.cycleDays }, (_, i) => i + 1).map((day) => (
                            <td key={day} className="px-2 py-2">
                              <select
                                value={cellShifts[`${empId}:${day}`] ?? ''}
                                onChange={(e) => setCellShifts((prev) => ({ ...prev, [`${empId}:${day}`]: e.target.value }))}
                                className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                <option value="">Off</option>
                                {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Apply starting</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="repeatCycles">Repeat cycles</Label>
                <Input id="repeatCycles" type="number" min={1} value={repeatCycles} onChange={(e) => setRepeatCycles(Number(e.target.value))} className="w-24" />
              </div>
              <Button onClick={handleApply} disabled={applying || !startDate || selectedEmployeeIds.length === 0}>
                {applying && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Apply to date range
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedRoster && (
        <Card>
          <CardHeader><CardTitle>Current Assignments</CardTitle></CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments yet for this roster.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Employee</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 tabular-nums">{new Date(a.workDate).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })}</td>
                        <td className="px-3 py-2">{a.employee.firstName} {a.employee.lastName}</td>
                        <td className="px-3 py-2">{a.shift.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
