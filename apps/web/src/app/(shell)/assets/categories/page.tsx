'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftCircle, Loader2, Pencil, Plus, Trash2, X, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Category {
  id: string;
  code: string;
  name: string;
  trackingMode: 'serialized' | 'consumable';
  depreciationMethod: string;
  usefulLifeMonths: number | null;
  defaultWarrantyMonths: number | null;
  requiresAssetTag: boolean;
  displayOrder: number;
  isActive: boolean;
}

const DEPRECIATION_METHODS = [
  { value: 'none',              label: 'None' },
  { value: 'straight_line',     label: 'Straight-line' },
  { value: 'reducing_balance',  label: 'Reducing balance' },
];

export default function CategoriesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    api.get<Category[]>('/assets/categories')
      .then(setRows)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: string) {
    if (!confirm('Delete this category? Existing units retain the reference.')) return;
    setError(null);
    try { await api.delete(`/assets/categories/${id}`); reload(); }
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
          <h1 className="font-display text-2xl font-semibold text-foreground">Asset Categories</h1>
          <p className="text-sm text-muted-foreground">
            Serialized categories track per-unit; consumables track quantity per location.
          </p>
        </div>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add category
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {creating && (
        <CategoryEditor
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
          No categories yet. Add one to start recording purchases and units.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-left">Depreciation</th>
                  <th className="px-4 py-2 text-right">Life (mo)</th>
                  <th className="px-4 py-2 text-right">Warranty (mo)</th>
                  <th className="px-4 py-2 text-center">Active</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) =>
                  editing === r.id ? (
                    <tr key={r.id}>
                      <td colSpan={8} className="p-3 bg-muted/30">
                        <CategoryEditor
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
                      <td className="px-4 py-2 text-muted-foreground">{r.trackingMode}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.depreciationMethod}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {r.usefulLifeMonths ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {r.defaultWarrantyMonths ?? '—'}
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

interface CategoryEditorProps {
  initial?: Category;
  onCancel: () => void;
  onSaved: () => void;
  onError: (_msg: string) => void;
}

function CategoryEditor({ initial, onCancel, onSaved, onError }: CategoryEditorProps) {
  const [code, setCode]                 = useState(initial?.code ?? '');
  const [name, setName]                 = useState(initial?.name ?? '');
  const [trackingMode, setTrackingMode] = useState<'serialized' | 'consumable'>(initial?.trackingMode ?? 'serialized');
  const [deprec, setDeprec]             = useState(initial?.depreciationMethod ?? 'none');
  const [life, setLife]                 = useState(initial?.usefulLifeMonths?.toString() ?? '');
  const [warranty, setWarranty]         = useState(initial?.defaultWarrantyMonths?.toString() ?? '');
  const [active, setActive]             = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name) { onError('Name is required'); return; }
    if (!initial && !code) { onError('Code is required'); return; }
    setBusy(true);
    try {
      const payload = {
        name,
        depreciationMethod: deprec,
        usefulLifeMonths:      life     ? Number(life)     : undefined,
        defaultWarrantyMonths: warranty ? Number(warranty) : undefined,
        isActive: active,
      };
      if (initial) {
        await api.patch(`/assets/categories/${initial.id}`, payload);
      } else {
        await api.post('/assets/categories', { code: code.trim().toUpperCase(), trackingMode, ...payload });
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
              placeholder="e.g. MONITOR"
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Tracking mode</label>
            <select
              value={trackingMode}
              disabled={!!initial}
              onChange={(e) => setTrackingMode(e.target.value as 'serialized' | 'consumable')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
            >
              <option value="serialized">Serialized</option>
              <option value="consumable">Consumable</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Depreciation</label>
            <select
              value={deprec}
              onChange={(e) => setDeprec(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DEPRECIATION_METHODS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Life (months)</label>
            <input
              type="number"
              value={life}
              onChange={(e) => setLife(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Default warranty (months)</label>
            <input
              type="number"
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums"
            />
          </div>
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
