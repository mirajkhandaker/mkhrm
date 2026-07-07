'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, ClipboardCheck, Eye, Loader2, Map, Package, Pencil, Search } from 'lucide-react';
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
  category?: { name: string; code: string };
  condition?: { name: string };
  currentHolderType: string;
  currentEmployee?: { firstName: string; lastName: string } | null;
  currentDepartment?: { name: string } | null;
  currentLocation?: { name: string; code: string } | null;
}

interface StockRow {
  id: string;
  categoryId: string;
  locationId: string;
  quantity: number;
  minQuantity: number | null;
  category?: { name: string; code: string };
  location?: { name: string; code: string };
}

interface CategoryOption { id: string; name: string; code: string; trackingMode: string }
interface LocationOption { id: string; name: string; code: string }

const STATUS_STYLES: Record<string, string> = {
  in_stock:       'border-info text-info bg-info/5',
  assigned:       'border-primary text-primary bg-primary-soft',
  in_maintenance: 'border-warning text-warning bg-warning/5',
  retired:        'border-muted-foreground text-muted-foreground',
  lost:           'border-danger text-danger bg-danger/5',
};

export default function AssetsInventoryPage() {
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<'units' | 'consumables'>('units');
  const [units, setUnits] = useState<AssetUnit[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<CategoryOption[]>('/assets/categories'),
      api.get<LocationOption[]>('/assets/locations'),
    ])
      .then(([cats, locs]) => { setCategories(cats); setLocations(locs); })
      .catch((e: ApiError) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (filterCategory) query.set('categoryId', filterCategory);
    if (filterLocation) query.set('locationId', filterLocation);
    if (filterStatus)   query.set('status', filterStatus);
    const qs = query.toString();

    if (tab === 'units') {
      api.get<AssetUnit[]>('/assets' + (qs ? '?' + qs : ''))
        .then(setUnits)
        .catch((e: ApiError) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      const stockQuery = new URLSearchParams();
      if (filterCategory) stockQuery.set('categoryId', filterCategory);
      if (filterLocation) stockQuery.set('locationId', filterLocation);
      const sqs = stockQuery.toString();
      api.get<StockRow[]>('/assets/stock' + (sqs ? '?' + sqs : ''))
        .then(setStock)
        .catch((e: ApiError) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [tab, filterCategory, filterLocation, filterStatus]);

  const filteredUnits = search
    ? units.filter((u) =>
        (u.assetTag + ' ' + u.name + ' ' + (u.serialNo ?? '')).toLowerCase().includes(search.toLowerCase()),
      )
    : units;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground">Inventory, assignments, and consumable stock.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/assets/distribution"><Map className="h-4 w-4 mr-1.5" />Distribution</Link>
          </Button>
          {hasPermission('asset.purchase.create') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/assets/purchases"><Package className="h-4 w-4 mr-1.5" />Purchases</Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/assets/my"><Boxes className="h-4 w-4 mr-1.5" />My Assets</Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['units', 'consumables'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'units' ? 'Units' : 'Consumables'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search tag / name / serial"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories
            .filter((c) => tab === 'units' ? c.trackingMode === 'serialized' : c.trackingMode === 'consumable')
            .map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All locations</option>
          {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
        </select>
        {tab === 'units' && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Any status</option>
            <option value="in_stock">In stock</option>
            <option value="assigned">Assigned</option>
            <option value="in_maintenance">In maintenance</option>
            <option value="retired">Retired</option>
            <option value="lost">Lost</option>
          </select>
        )}
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : tab === 'units' ? (
        filteredUnits.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No assets found.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Tag</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Holder</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUnits.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">
                        <Link href={`/assets/${u.id}`} className="text-primary hover:underline">{u.assetTag}</Link>
                      </td>
                      <td className="px-4 py-2">{u.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{u.category?.name ?? ''}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.currentHolderType === 'employee'   && u.currentEmployee   ? `${u.currentEmployee.firstName} ${u.currentEmployee.lastName}` :
                         u.currentHolderType === 'department' && u.currentDepartment ? u.currentDepartment.name :
                         u.currentHolderType === 'location'   && u.currentLocation   ? u.currentLocation.name :
                         '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[u.status] ?? '')}>{u.status.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">${Number(u.purchaseCost).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm" title="View">
                            <Link href={`/assets/${u.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                          </Button>
                          {u.status !== 'retired' && hasPermission('asset.unit.assign') && (
                            <Button asChild variant="ghost" size="sm" title="Assign">
                              <Link href={`/assets/${u.id}?action=assign`}><ClipboardCheck className="h-3.5 w-3.5" /></Link>
                            </Button>
                          )}
                          {hasPermission('asset.unit.update') && (
                            <Button asChild variant="ghost" size="sm" title="Edit">
                              <Link href={`/assets/${u.id}?action=edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      ) : (
        stock.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No consumable stock yet.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Location</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Min</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stock.map((s) => {
                    const min = s.minQuantity ?? null;
                    const low = min != null && s.quantity <= min;
                    return (
                      <tr key={s.id} className={cn(low && 'bg-warning/10')}>
                        <td className="px-4 py-2">{s.category?.name ?? ''}</td>
                        <td className="px-4 py-2 text-muted-foreground">{s.location?.name ?? ''}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{s.quantity}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{min ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
