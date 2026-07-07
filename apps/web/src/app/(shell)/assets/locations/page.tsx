'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftCircle, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Location {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  address: string | null;
  isActive: boolean;
}

export default function LocationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    api.get<Location[]>('/assets/locations')
      .then(setRows)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: string) {
    if (!confirm('Delete this location? Units and stock still reference it historically.')) return;
    setError(null);
    try { await api.delete(`/assets/locations/${id}`); reload(); }
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
          <h1 className="font-display text-2xl font-semibold text-foreground">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Where assets live. Locations can nest — HQ → Floor 1 → Room A.
          </p>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add location
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {creating && (
        <LocationEditor
          rows={rows}
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
          No locations yet.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Parent</th>
                  <th className="px-4 py-2 text-left">Address</th>
                  <th className="px-4 py-2 text-center">Active</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) =>
                  editing === r.id ? (
                    <tr key={r.id}>
                      <td colSpan={6} className="p-3 bg-muted/30">
                        <LocationEditor
                          initial={r}
                          rows={rows}
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
                      <td className="px-4 py-2 text-muted-foreground">
                        {rows.find((p) => p.id === r.parentId)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-xs">
                        {r.address ?? '—'}
                      </td>
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

interface EditorProps {
  initial?: Location;
  rows: Location[];
  onCancel: () => void;
  onSaved: () => void;
  onError: (_msg: string) => void;
}

function LocationEditor({ initial, rows, onCancel, onSaved, onError }: EditorProps) {
  const [code, setCode]         = useState(initial?.code ?? '');
  const [name, setName]         = useState(initial?.name ?? '');
  const [parentId, setParentId] = useState(initial?.parentId ?? '');
  const [address, setAddress]   = useState(initial?.address ?? '');
  const [active, setActive]     = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name) { onError('Name is required'); return; }
    if (!initial && !code) { onError('Code is required'); return; }
    setBusy(true);
    try {
      if (initial) {
        await api.patch(`/assets/locations/${initial.id}`, {
          name,
          parentId: parentId || null,
          address: address || undefined,
          isActive: active,
        });
      } else {
        await api.post('/assets/locations', {
          code: code.trim().toUpperCase(),
          name,
          parentId: parentId || undefined,
          address: address || undefined,
          isActive: active,
        });
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
          <label className="text-xs text-muted-foreground">Parent</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— none —</option>
            {rows.filter((r) => r.id !== initial?.id).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
