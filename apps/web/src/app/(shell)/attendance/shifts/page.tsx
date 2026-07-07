'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, CheckCircle, Clock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';

interface Shift {
  id: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  halfDayThresholdMinutes: number;
  workingHours: number;
}

const DEFAULT_FORM = {
  name: '',
  type: 'fixed',
  startTime: '09:00',
  endTime: '17:00',
  graceMinutes: 15,
  halfDayThresholdMinutes: 240,
  workingHours: 8,
};

export default function ShiftsAdminPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<Shift[]>('/attendance/shifts')
      .then(setShifts)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setForm({ ...DEFAULT_FORM });
    setEditId(null);
    setShowForm(true);
    setError(null);
  }

  function startEdit(s: Shift) {
    setForm({
      name: s.name,
      type: s.type,
      startTime: s.startTime.slice(0, 5),
      endTime: s.endTime.slice(0, 5),
      graceMinutes: s.graceMinutes,
      halfDayThresholdMinutes: s.halfDayThresholdMinutes,
      workingHours: Number(s.workingHours),
    });
    setEditId(s.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editId) {
        await api.patch(`/attendance/shifts/${editId}`, form);
        setSuccess('Shift updated');
      } else {
        await api.post('/attendance/shifts', form);
        setSuccess('Shift created');
      }
      setShowForm(false);
      setEditId(null);
      setLoading(true);
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save shift');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this shift? Schedules and rosters referencing it will be affected.')) return;
    try {
      await api.delete(`/attendance/shifts/${id}`);
      setShifts((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to delete shift');
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
        title="Shifts"
        description="Configure fixed and roster shift definitions"
        actions={
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Shift
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

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? 'Edit Shift' : 'New Shift'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-danger">*</span></Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. General Shift"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="fixed">Fixed</option>
                  <option value="roster">Roster</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime">Start time <span className="text-danger">*</span></Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">End time <span className="text-danger">*</span></Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="graceMinutes">Grace period (minutes)</Label>
                <Input
                  id="graceMinutes"
                  type="number"
                  min={0}
                  value={form.graceMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, graceMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="halfDayThresholdMinutes">Half-day threshold (minutes)</Label>
                <Input
                  id="halfDayThresholdMinutes"
                  type="number"
                  min={0}
                  value={form.halfDayThresholdMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, halfDayThresholdMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workingHours">Working hours</Label>
                <Input
                  id="workingHours"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.workingHours}
                  onChange={(e) => setForm((f) => ({ ...f, workingHours: Number(e.target.value) }))}
                />
              </div>
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  {editId ? 'Save Changes' : 'Create Shift'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {shifts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No shifts configured</p>
            <p className="text-sm text-muted-foreground">Add a shift so schedules and rosters have something to assign.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hours</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grace</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Half-day at</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className="text-xs capitalize">{s.type}</Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}</td>
                    <td className="px-5 py-3 tabular-nums">{s.graceMinutes} min</td>
                    <td className="px-5 py-3 tabular-nums">{s.halfDayThresholdMinutes} min</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger hover:bg-danger/10"
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
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
