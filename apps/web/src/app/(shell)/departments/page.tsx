'use client';

import { useState, useEffect, FormEvent } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Dept { id: string; name: string; code: string; parentId?: string; }

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', code: '' });
  const [editing, setEditing] = useState<Dept | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    try { setDepts(await api.get<Dept[]>('/departments')); }
    catch { setError('Failed to load departments.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/departments/${editing.id}`, form);
      } else {
        await api.post('/departments', form);
      }
      setForm({ name: '', code: '' });
      setEditing(null);
      await load();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Save failed.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this department?')) return;
    try { await api.delete(`/departments/${id}`); await load(); }
    catch { setError('Delete failed.'); }
  }

  const field = 'block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20';

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold text-foreground">Departments</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card p-5 shadow-sm space-y-4 lg:col-span-1 h-fit">
          <h2 className="text-sm font-semibold text-foreground">{editing ? 'Edit department' : 'New department'}</h2>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Name</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={field} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">Code</label>
            <input required value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className={field} />
          </div>
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex gap-2">
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm({ name: '', code: '' }); }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                Cancel
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-60">
              <Plus className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add department'}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="lg:col-span-2 rounded-2xl bg-card shadow-sm overflow-hidden">
          {loading && <p className="p-6 text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="p-6 text-sm text-danger">{error}</p>}
          {!loading && !error && depts.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No departments yet. Create one to get started.</p>
          )}
          {!loading && !error && depts.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {depts.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-primary-soft/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{d.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.code}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditing(d); setForm({ name: d.name, code: d.code }); }}
                          aria-label={`Edit ${d.name}`}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(d.id)}
                          aria-label={`Delete ${d.name}`}
                          className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
