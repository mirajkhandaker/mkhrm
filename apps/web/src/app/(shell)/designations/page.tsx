'use client';

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';

interface Dept { id: string; name: string; code: string }
interface Desig {
  id: string;
  title: string;
  level: number | null;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
}

export default function DesignationsPage() {
  const [desigs, setDesigs] = useState<Desig[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ title: string; level: string; departmentId: string }>({
    title: '', level: '', departmentId: '',
  });
  const [editing, setEditing] = useState<Desig | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [d, dp] = await Promise.all([
        api.get<Desig[]>('/designations'),
        api.get<Dept[]>('/departments'),
      ]);
      setDesigs(d);
      setDepts(dp);
    } catch { setError('Failed to load designations.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = { title: form.title };
      body.level = form.level ? Number(form.level) : undefined;
      body.departmentId = form.departmentId || undefined;
      if (editing) {
        await api.patch(`/designations/${editing.id}`, body);
      } else {
        await api.post('/designations', body);
      }
      setForm({ title: '', level: '', departmentId: '' });
      setEditing(null);
      await load();
    } catch (err: unknown) {
      setFormError((err as { message?: string })?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this designation?')) return;
    try { await api.delete(`/designations/${id}`); await load(); }
    catch { setError('Delete failed.'); }
  }

  function startEdit(d: Desig) {
    setEditing(d);
    setForm({ title: d.title, level: d.level?.toString() ?? '', departmentId: d.departmentId ?? '' });
  }

  const field = 'block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';

  const visible = useMemo(
    () => (filterDept
      ? desigs.filter((d) => (filterDept === '__none__' ? !d.departmentId : d.departmentId === filterDept))
      : desigs),
    [desigs, filterDept],
  );

  // Group visible designations by department for display.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; rows: Desig[] }>();
    for (const d of visible) {
      const key = d.departmentId ?? '__none__';
      const name = d.department?.name ?? 'Unassigned';
      if (!map.has(key)) map.set(key, { name, rows: [] });
      map.get(key)!.rows.push(d);
    }
    return [...map.values()].sort((a, b) => {
      if (a.name === 'Unassigned') return 1;
      if (b.name === 'Unassigned') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [visible]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-foreground">Designations</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card p-5 shadow-sm space-y-4 lg:col-span-1 h-fit">
          <h2 className="text-sm font-semibold text-foreground">{editing ? 'Edit designation' : 'New designation'}</h2>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Title</label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={field} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Department</label>
            <select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))} className={field}>
              <option value="">— unassigned —</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Level <span className="text-muted-foreground/60">(optional, 1 = senior-most)</span></label>
            <input type="number" min={1} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} className={field} />
          </div>
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex gap-2">
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm({ title: '', level: '', departmentId: '' }); }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                Cancel
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-60">
              <Plus className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add designation'}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-end">
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="">All departments</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              <option value="__none__">Unassigned</option>
            </select>
          </div>

          {loading && <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-sm">Loading…</p>}
          {error && <p className="rounded-2xl bg-card p-6 text-sm text-danger shadow-sm">{error}</p>}
          {!loading && !error && visible.length === 0 && (
            <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-sm">No designations yet. Create one to get started.</p>
          )}

          {!loading && !error && grouped.map((group) => (
            <div key={group.name} className="rounded-2xl bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-medium text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                {group.name}
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{group.rows.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2 w-24">Level</th>
                    <th className="px-4 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0 hover:bg-primary-soft/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{d.title}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{d.level ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(d)} aria-label={`Edit ${d.title}`}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(d.id)} aria-label={`Delete ${d.title}`}
                            className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
