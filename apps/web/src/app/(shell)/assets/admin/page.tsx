'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Category {
  id: string; code: string; name: string;
  trackingMode: 'serialized' | 'consumable';
  depreciationMethod: string;
  usefulLifeMonths: number | null;
  defaultWarrantyMonths: number | null;
  requiresAssetTag: boolean;
  displayOrder: number;
  isActive: boolean;
}
interface Location { id: string; code: string; name: string; parentId: string | null; isActive: boolean }
interface Condition { id: string; code: string; name: string; displayOrder: number; isActive: boolean }

type Tab = 'categories' | 'locations' | 'conditions' | 'import';

export default function AssetsAdminPage() {
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <div className="space-y-6 p-6">
      <h1 className="font-display text-2xl font-semibold">Asset Configuration</h1>
      <p className="text-sm text-muted-foreground">Categories, locations, conditions, and bulk import.</p>

      <div className="flex gap-1 border-b border-border">
        {(['categories', 'locations', 'conditions', 'import'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'locations'  && <LocationsTab />}
      {tab === 'conditions' && <ConditionsTab />}
      {tab === 'import'     && <ImportTab />}
    </div>
  );
}

function CategoriesTab() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [trackingMode, setTrackingMode] = useState<'serialized' | 'consumable'>('serialized');

  function reload() {
    setLoading(true);
    api.get<Category[]>('/assets/categories').then(setRows)
      .catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function create() {
    if (!code || !name) { setError('Code and name required'); return; }
    setError(null);
    try {
      await api.post('/assets/categories', { code, name, trackingMode });
      setCode(''); setName(''); setCreating(false); reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
  }

  return (
    <>
      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}

      <div className="flex justify-end">
        {creating ? (
          <Card className="w-full max-w-lg"><CardContent className="pt-4 space-y-2">
            <input placeholder="Code (e.g. MONITOR)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            <select value={trackingMode} onChange={(e) => setTrackingMode(e.target.value as 'serialized' | 'consumable')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="serialized">Serialized (per-unit tracking)</option>
              <option value="consumable">Consumable (stock by quantity)</option>
            </select>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" onClick={create}>Create</Button>
            </div>
          </CardContent></Card>
        ) : (
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1.5" /> Add category</Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Mode</th>
              <th className="px-4 py-2 text-left">Depreciation</th>
              <th className="px-4 py-2 text-right">Life (mo)</th>
              <th className="px-4 py-2 text-right">Warranty (mo)</th>
              <th className="px-4 py-2 text-left">Active</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.trackingMode}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.depreciationMethod}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.usefulLifeMonths ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.defaultWarrantyMonths ?? '—'}</td>
                  <td className="px-4 py-2">{r.isActive ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </>
  );
}

function LocationsTab() {
  const [rows, setRows] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    api.get<Location[]>('/assets/locations').then(setRows)
      .catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function create() {
    if (!code || !name) { setError('Code and name required'); return; }
    setError(null);
    try {
      await api.post('/assets/locations', { code, name, parentId: parentId || undefined });
      setCode(''); setName(''); setParentId(''); setCreating(false); reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
  }

  return (
    <>
      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}

      <div className="flex justify-end">
        {creating ? (
          <Card className="w-full max-w-lg"><CardContent className="pt-4 space-y-2">
            <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— parent (optional) —</option>
              {rows.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" onClick={create}>Create</Button>
            </div>
          </CardContent></Card>
        ) : (
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1.5" /> Add location</Button>
        )}
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Parent</th>
              <th className="px-4 py-2 text-left">Active</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{rows.find((p) => p.id === r.parentId)?.name ?? '—'}</td>
                  <td className="px-4 py-2">{r.isActive ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </>
  );
}

function ConditionsTab() {
  const [rows, setRows] = useState<Condition[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    api.get<Condition[]>('/assets/conditions').then(setRows)
      .catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function create() {
    if (!code || !name) { setError('Code and name required'); return; }
    setError(null);
    try {
      await api.post('/assets/conditions', { code, name });
      setCode(''); setName(''); setCreating(false); reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
  }

  return (
    <>
      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}
      <div className="flex justify-end">
        {creating ? (
          <Card className="w-full max-w-lg"><CardContent className="pt-4 space-y-2">
            <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button size="sm" onClick={create}>Create</Button>
            </div>
          </CardContent></Card>
        ) : (
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1.5" /> Add condition</Button>
        )}
      </div>
      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card><CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Active</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{r.isActive ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </>
  );
}

interface ImportResult {
  total: number; inserted: number; skipped: number;
  errors: Array<{ row: number; message: string; raw: Record<string, string> }>;
}

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/assets/units/import', {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: { Authorization: `Bearer ${window.__accessToken ?? ''}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;
      setResult(body as ImportResult);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Upload failed');
    } finally { setBusy(false); }
  }

  return (
    <Card><CardContent className="pt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a CSV or XLSX to seed pre-owned units. Required columns:
        <span className="font-mono"> asset_tag, name, category_code, condition_code, location_code, purchased_on</span>.
        Optional: <span className="font-mono">serial_no, purchase_cost, warranty_until, notes</span>.
        Rows with an existing <span className="font-mono">asset_tag</span> are skipped.
      </p>
      <div>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => {
          const f = e.target.files?.[0]; if (f) upload(f);
        }} />
      </div>
      {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Importing…</div>}
      {error && <div className="text-sm text-danger">{error}</div>}
      {result && (
        <div className="text-sm space-y-1">
          <div>Total rows: <span className="tabular-nums">{result.total}</span></div>
          <div>Inserted: <span className="text-success tabular-nums">{result.inserted}</span></div>
          <div>Skipped (existing tag): <span className="text-muted-foreground tabular-nums">{result.skipped}</span></div>
          <div>Errors: <span className="text-danger tabular-nums">{result.errors.length}</span></div>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-danger">
              {result.errors.slice(0, 20).map((e, i) => (
                <li key={i}>Row {e.row}: {e.message}</li>
              ))}
              {result.errors.length > 20 && <li>… and {result.errors.length - 20} more</li>}
            </ul>
          )}
        </div>
      )}
    </CardContent></Card>
  );
}
