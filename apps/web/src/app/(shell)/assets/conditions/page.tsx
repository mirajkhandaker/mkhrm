'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftCircle, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Condition {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export default function ConditionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    api.get<Condition[]>('/assets/conditions')
      .then(setRows)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: string) {
    if (!confirm('Delete this condition?')) return;
    setError(null);
    try { await api.delete(`/assets/conditions/${id}`); reload(); }
    catch (err: unknown) { setError((err as ApiError).message ?? 'Failed to delete'); }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}>
          <ArrowLeftCircle className="h-4 w-4 mr-1.5" /> Back to inventory
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Conditions</h1>
          <p className="text-sm text-muted-foreground">New / Good / Fair / Damaged — attach to each unit.</p>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add condition
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {creating && (
        <ConditionEditor
          onCancel={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); }}
          onError={setError}
        />
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          No conditions yet.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right">Order</th>
                  <th className="px-4 py-2 text-center">Active</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) =>
                  editing === r.id ? (
                    <tr key={r.id}>
                      <td colSpan={5} className="p-3 bg-muted/30">
                        <ConditionEditor
                          initial={r}
                          onCancel={() => setEditing(null)}
                          onSaved={() => { setEditing(null); reload(); }}
                          onError={setError}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.displayOrder}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge variant="outline" className={r.isActive ? 'border-success text-success' : 'border-muted-foreground text-muted-foreground'}>
                          {r.isActive ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(r.id)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(r.id)} title="Delete" className="text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ConditionEditorProps {
  initial?: Condition;
  onCancel: () => void;
  onSaved: () => void;
  onError: (_msg: string) => void;
}

function ConditionEditor({ initial, onCancel, onSaved, onError }: ConditionEditorProps) {
  const [code, setCode]           = useState(initial?.code ?? '');
  const [name, setName]           = useState(initial?.name ?? '');
  const [displayOrder, setOrder]  = useState(initial?.displayOrder?.toString() ?? '0');
  const [active, setActive]       = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name) { onError('Name is required'); return; }
    if (!initial && !code) { onError('Code is required'); return; }
    setBusy(true);
    try {
      const payload = { name, displayOrder: Number(displayOrder || '0'), isActive: active };
      if (initial) {
        await api.patch(`/assets/conditions/${initial.id}`, payload);
      } else {
        await api.post('/assets/conditions', { code: code.trim().toUpperCase(), ...payload });
      }
      onSaved();
    } catch (err: unknown) {
      onError((err as ApiError).message ?? 'Save failed');
    } finally { setBusy(false); }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Code</label>
            <input
              value={code}
              disabled={!!initial}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono disabled:opacity-60"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Display order</label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setOrder(e.target.value)}
            className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm tabular-nums"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" />
          Active
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-1.5" /> Cancel</Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" /> Save</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
