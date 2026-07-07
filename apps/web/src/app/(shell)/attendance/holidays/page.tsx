'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, CheckCircle, PartyPopper } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  isRecurring: boolean;
}

const DEFAULT_FORM = { name: '', date: '', type: 'company', isRecurring: false };

const TYPE_STYLES: Record<string, string> = {
  government: 'border-info text-info',
  optional: 'border-warning text-warning',
  company: 'border-primary text-primary',
};

export default function HolidaysAdminPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<Holiday[]>('/attendance/holidays')
      .then(setHolidays)
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

  function startEdit(h: Holiday) {
    setForm({ name: h.name, date: h.date, type: h.type, isRecurring: h.isRecurring });
    setEditId(h.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editId) {
        await api.patch(`/attendance/holidays/${editId}`, form);
        setSuccess('Holiday updated');
      } else {
        await api.post('/attendance/holidays', form);
        setSuccess('Holiday created');
      }
      setShowForm(false);
      setEditId(null);
      setLoading(true);
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save holiday');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this holiday?')) return;
    try {
      await api.delete(`/attendance/holidays/${id}`);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to delete holiday');
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
        title="Holidays"
        description="Manage the organization's holiday calendar"
        actions={
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Holiday
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
            <CardTitle>{editId ? 'Edit Holiday' : 'New Holiday'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-danger">*</span></Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Independence Day"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date <span className="text-danger">*</span></Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
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
                  <option value="government">Government</option>
                  <option value="optional">Optional</option>
                  <option value="company">Company</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Recurs every year
                </label>
              </div>
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  {editId ? 'Save Changes' : 'Create Holiday'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {holidays.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <PartyPopper className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No holidays configured</p>
            <p className="text-sm text-muted-foreground">Add holidays so attendance days off resolve correctly.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recurring</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{h.name}</td>
                    <td className="px-5 py-3 tabular-nums">{new Date(h.date).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className={`text-xs capitalize ${TYPE_STYLES[h.type] ?? ''}`}>{h.type}</Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{h.isRecurring ? 'Yes' : 'No'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(h)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger hover:bg-danger/10"
                          onClick={() => handleDelete(h.id)}
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
