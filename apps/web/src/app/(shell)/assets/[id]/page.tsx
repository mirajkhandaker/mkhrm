'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeftCircle,
  ArrowRightLeft,
  Ban,
  ClipboardCheck,
  History as HistoryIcon,
  Loader2,
  Pencil,
  Undo2,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AssetUnit {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  serialNo: string | null;
  purchaseCost: number;
  purchasedOn: string;
  warrantyUntil: string | null;
  notes: string | null;
  currentHolderType: string;
  currentEmployee?: { id: string; firstName: string; lastName: string } | null;
  currentDepartment?: { id: string; name: string } | null;
  currentLocation?: { id: string; name: string } | null;
  category?: { id: string; name: string };
  condition?: { id: string; name: string };
}

interface Movement {
  id: string;
  movementType: string;
  fromHolderType: string | null;
  toHolderType: string | null;
  quantity: number;
  note: string | null;
  performedAt: string;
  performer?: { firstName: string; lastName: string };
}

interface MaintenanceRecord {
  id: string;
  startedAt: string;
  endedAt: string | null;
  cost: number;
  vendor: string | null;
  description: string;
  outcome: string | null;
}

interface EmployeeOption { id: string; firstName: string; lastName: string }
interface DeptOption { id: string; name: string }
interface LocationOption { id: string; name: string }
interface ConditionOption { id: string; name: string }

const STATUS_STYLES: Record<string, string> = {
  in_stock:       'border-info text-info bg-info/5',
  assigned:       'border-primary text-primary bg-primary-soft',
  in_maintenance: 'border-warning text-warning bg-warning/5',
  retired:        'border-muted-foreground text-muted-foreground',
  lost:           'border-danger text-danger bg-danger/5',
};

type ActionKind = 'assign' | 'return' | 'transfer' | 'retire' | 'maintenance' | 'edit';

export default function AssetUnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();

  const [unit, setUnit] = useState<AssetUnit | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [conditions, setConditions] = useState<ConditionOption[]>([]);
  const [tab, setTab] = useState<'history' | 'maintenance'>('history');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<null | ActionKind>(null);
  const [busy, setBusy] = useState(false);

  // form state (per-action)
  const [holderType, setHolderType] = useState<'employee' | 'department' | 'location'>('employee');
  const [holderId, setHolderId] = useState('');
  const [note, setNote] = useState('');
  const [returnLocationId, setReturnLocationId] = useState('');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenanceVendor, setMaintenanceVendor] = useState('');
  const [editName, setEditName]         = useState('');
  const [editSerial, setEditSerial]     = useState('');
  const [editConditionId, setEditCond]  = useState('');
  const [editNotes, setEditNotes]       = useState('');

  function reload() {
    setLoading(true);
    Promise.all([
      api.get<AssetUnit>(`/assets/${id}`),
      api.get<Movement[]>(`/assets/${id}/history`),
      api.get<MaintenanceRecord[]>(`/assets/${id}/maintenance`),
    ])
      .then(([u, h, m]) => { setUnit(u); setHistory(h); setMaintenance(m); })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    Promise.all([
      api.get<{ data: EmployeeOption[] }>('/employees?limit=1000').catch(() => ({ data: [] })),
      api.get<DeptOption[]>('/departments').catch(() => []),
      api.get<LocationOption[]>('/assets/locations').catch(() => []),
      api.get<ConditionOption[]>('/assets/conditions').catch(() => []),
    ]).then(([e, d, l, c]) => {
      setEmployees((e as { data: EmployeeOption[] }).data ?? []);
      setDepartments(d as DeptOption[]);
      setLocations(l as LocationOption[]);
      setConditions(c as ConditionOption[]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Deep-link into a specific action panel from the inventory list.
  useEffect(() => {
    if (!unit) return;
    const requested = searchParams.get('action') as ActionKind | null;
    if (!requested) return;
    if (requested === 'edit') {
      setEditName(unit.name);
      setEditSerial(unit.serialNo ?? '');
      setEditCond(unit.condition?.id ?? '');
      setEditNotes(unit.notes ?? '');
    }
    setAction(requested);
  // Only respond to the initial value once the unit has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit?.id]);

  async function submitAssign() {
    if (!holderId) { setError('Choose a holder'); return; }
    setBusy(true); setError(null);
    try {
      await api.post(`/assets/${id}/assign`, { type: holderType, id: holderId, note });
      setAction(null); setNote(''); setHolderId('');
      reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  async function submitReturn() {
    if (!returnLocationId) { setError('Choose a location'); return; }
    setBusy(true); setError(null);
    try {
      await api.post(`/assets/${id}/return`, { toLocationId: returnLocationId, note });
      setAction(null); setNote(''); setReturnLocationId('');
      reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  async function submitTransfer() {
    if (!holderId) { setError('Choose a holder'); return; }
    setBusy(true); setError(null);
    try {
      await api.post(`/assets/${id}/transfer`, { type: holderType, id: holderId, note });
      setAction(null); setNote(''); setHolderId('');
      reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  async function submitRetire() {
    if (!confirm('Retire this asset? This cannot be undone.')) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/assets/${id}/retire`, { reason: note });
      setAction(null); setNote('');
      reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  async function submitEdit() {
    if (!editName.trim()) { setError('Name is required'); return; }
    setBusy(true); setError(null);
    try {
      await api.patch(`/assets/${id}`, {
        name: editName.trim(),
        serialNo: editSerial.trim() || undefined,
        conditionId: editConditionId || undefined,
        notes: editNotes || undefined,
      });
      setAction(null);
      reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  async function startMaintenance() {
    if (!maintenanceDescription) { setError('Describe the issue'); return; }
    setBusy(true); setError(null);
    try {
      await api.post(`/assets/maintenance/start`, {
        unitId: id,
        description: maintenanceDescription,
        vendor: maintenanceVendor || undefined,
      });
      setAction(null); setMaintenanceDescription(''); setMaintenanceVendor('');
      reload();
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  if (loading || !unit) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const holderName =
    unit.currentHolderType === 'employee'   && unit.currentEmployee   ? `${unit.currentEmployee.firstName} ${unit.currentEmployee.lastName}` :
    unit.currentHolderType === 'department' && unit.currentDepartment ? unit.currentDepartment.name :
    unit.currentHolderType === 'location'   && unit.currentLocation   ? unit.currentLocation.name :
    '—';

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}>
        <ArrowLeftCircle className="h-4 w-4 mr-1.5" /> Back to inventory
      </Button>

      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-foreground">{unit.name}</h1>
            <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[unit.status] ?? '')}>{unit.status.replace('_', ' ')}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{unit.assetTag}</span>
            {unit.serialNo && <> · S/N <span className="font-mono">{unit.serialNo}</span></>}
            {' · '}Purchased {unit.purchasedOn}
            {unit.warrantyUntil && <> · Warranty until {unit.warrantyUntil}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('asset.unit.update') && (
            <Button size="sm" variant="outline" onClick={() => {
              setAction('edit');
              setEditName(unit.name);
              setEditSerial(unit.serialNo ?? '');
              setEditCond(unit.condition?.id ?? '');
              setEditNotes(unit.notes ?? '');
              setError(null);
            }}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit
            </Button>
          )}
          {unit.status !== 'retired' && hasPermission('asset.unit.assign') && (
            <Button size="sm" variant="outline" onClick={() => { setAction('assign'); setHolderType('employee'); setError(null); }}>
              <ClipboardCheck className="h-4 w-4 mr-1.5" /> Assign
            </Button>
          )}
          {unit.status === 'assigned' && hasPermission('asset.unit.assign') && (
            <Button size="sm" variant="outline" onClick={() => { setAction('return'); setError(null); }}>
              <Undo2 className="h-4 w-4 mr-1.5" /> Return
            </Button>
          )}
          {unit.status !== 'retired' && hasPermission('asset.unit.transfer') && (
            <Button size="sm" variant="outline" onClick={() => { setAction('transfer'); setHolderType('employee'); setError(null); }}>
              <ArrowRightLeft className="h-4 w-4 mr-1.5" /> Transfer
            </Button>
          )}
          {unit.status !== 'retired' && unit.status !== 'in_maintenance' && hasPermission('asset.maintenance.log') && (
            <Button size="sm" variant="outline" onClick={() => { setAction('maintenance'); setError(null); }}>
              <Wrench className="h-4 w-4 mr-1.5" /> Maintenance
            </Button>
          )}
          {unit.status !== 'retired' && hasPermission('asset.unit.retire') && (
            <Button size="sm" variant="outline" className="text-danger" onClick={() => { setAction('retire'); setError(null); }}>
              <Ban className="h-4 w-4 mr-1.5" /> Retire
            </Button>
          )}
        </div>
      </div>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}

      <Card>
        <CardContent className="pt-4 grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
          <div><div className="text-muted-foreground text-xs">Category</div><div>{unit.category?.name ?? '—'}</div></div>
          <div><div className="text-muted-foreground text-xs">Condition</div><div>{unit.condition?.name ?? '—'}</div></div>
          <div><div className="text-muted-foreground text-xs">Current holder</div><div>{holderName}</div></div>
          <div><div className="text-muted-foreground text-xs">Purchase cost</div><div className="tabular-nums">${Number(unit.purchaseCost).toFixed(2)}</div></div>
        </CardContent>
      </Card>

      {/* Action panel (inline modal) */}
      {action && (
        <Card className="border-primary/40">
          <CardContent className="pt-4 space-y-3">
            <h3 className="font-medium">
              {action === 'assign'      && 'Assign this unit'}
              {action === 'transfer'    && 'Transfer this unit'}
              {action === 'return'      && 'Return to stock'}
              {action === 'retire'      && 'Retire this unit'}
              {action === 'maintenance' && 'Start maintenance'}
              {action === 'edit'        && 'Edit unit details'}
            </h3>

            {action === 'edit' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Serial number</label>
                  <input value={editSerial} onChange={(e) => setEditSerial(e.target.value)}
                    placeholder="Optional"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Condition</label>
                  <select value={editConditionId} onChange={(e) => setEditCond(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">— unchanged —</option>
                    {conditions.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </div>
              </div>
            )}

            {(action === 'assign' || action === 'transfer') && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {(['employee','department','location'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setHolderType(t); setHolderId(''); }}
                      className={cn(
                        'px-3 py-1 text-xs rounded-md border',
                        holderType === t ? 'border-primary text-primary bg-primary-soft' : 'border-border text-muted-foreground',
                      )}
                    >{t}</button>
                  ))}
                </div>
                <select
                  value={holderId}
                  onChange={(e) => setHolderId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— select —</option>
                  {holderType === 'employee' && employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                  ))}
                  {holderType === 'department' && departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                  {holderType === 'location' && locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {action === 'return' && (
              <select
                value={returnLocationId}
                onChange={(e) => setReturnLocationId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— return to which location —</option>
                {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            )}

            {action === 'maintenance' && (
              <>
                <input
                  placeholder="Description of the issue"
                  value={maintenanceDescription}
                  onChange={(e) => setMaintenanceDescription(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <input
                  placeholder="Vendor (optional)"
                  value={maintenanceVendor}
                  onChange={(e) => setMaintenanceVendor(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </>
            )}

            {action !== 'maintenance' && action !== 'edit' && (
              <textarea
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-16"
              />
            )}

            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setAction(null); setError(null); }}>Cancel</Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (action === 'assign')      submitAssign();
                  if (action === 'transfer')    submitTransfer();
                  if (action === 'return')      submitReturn();
                  if (action === 'retire')      submitRetire();
                  if (action === 'maintenance') startMaintenance();
                  if (action === 'edit')        submitEdit();
                }}
              >{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['history', 'maintenance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'history' ? <><HistoryIcon className="inline h-4 w-4 mr-1" /> History</> : <><Wrench className="inline h-4 w-4 mr-1" /> Maintenance</>}
          </button>
        ))}
      </div>

      {tab === 'history' ? (
        history.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No movement yet.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">By</th>
                  <th className="px-4 py-2 text-left">Note</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {history.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(m.performedAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{m.movementType.replace('_', ' ')}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.performer ? `${m.performer.firstName} ${m.performer.lastName}` : '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      ) : (
        maintenance.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No maintenance records.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr>
                  <th className="px-4 py-2 text-left">Started</th>
                  <th className="px-4 py-2 text-left">Ended</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Vendor</th>
                  <th className="px-4 py-2 text-left">Outcome</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {maintenance.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(r.startedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.endedAt ? new Date(r.endedAt).toLocaleDateString() : 'ongoing'}</td>
                      <td className="px-4 py-2">{r.description}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.vendor ?? '—'}</td>
                      <td className="px-4 py-2">{r.outcome ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
