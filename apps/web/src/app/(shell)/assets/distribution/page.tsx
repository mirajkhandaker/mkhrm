'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftCircle, Loader2, Building2, Users2, MapPin, PackageOpen } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UnitRow {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  currentHolderType: string;
  currentEmployee?: { firstName: string; lastName: string } | null;
  currentDepartment?: { name: string } | null;
  currentLocation?: { id: string; name: string } | null;
  category?: { name: string };
}

interface StockRow {
  id: string;
  quantity: number;
  minQuantity: number | null;
  category?: { name: string };
  location?: { id: string; name: string };
}

interface IssuedRow {
  id: string;
  performedAt: string;
  quantity: number;
  note: string | null;
  category: { id: string; name: string };
  fromLocation: { id: string; name: string } | null;
  toHolderType: string;
  toEmployee: { firstName: string; lastName: string } | null;
  toDepartment: { name: string } | null;
  toLocation: { name: string } | null;
  performer: { firstName: string; lastName: string } | null;
}

interface LocationOption { id: string; name: string }
interface CategoryOption { id: string; name: string; trackingMode: string }

type Tab = 'by-location' | 'stock' | 'issued';

export default function DistributionPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('by-location');

  const [units, setUnits] = useState<UnitRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [issued, setIssued] = useState<IssuedRow[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<LocationOption[]>('/assets/locations'),
      api.get<CategoryOption[]>('/assets/categories'),
    ])
      .then(([l, c]) => { setLocations(l); setCategories(c); })
      .catch((e: ApiError) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (filterCategory) query.set('categoryId', filterCategory);
    if (filterLocation) query.set('locationId', filterLocation);
    const qs = query.toString();

    const loaders: Promise<unknown>[] = [];
    if (tab === 'by-location') loaders.push(api.get<UnitRow[]>('/assets' + (qs ? '?' + qs : '')).then(setUnits));
    if (tab === 'stock')       loaders.push(api.get<StockRow[]>('/assets/stock' + (qs ? '?' + qs : '')).then(setStock));
    if (tab === 'issued')      loaders.push(api.get<IssuedRow[]>('/assets/stock/issued' + (qs ? '?' + qs : '')).then(setIssued));

    Promise.all(loaders)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, filterCategory, filterLocation]);

  // Group units by their current location for the by-location view.
  const unitsByLocation = useMemo(() => {
    const map = new Map<string, { location: LocationOption | { id: string; name: string }; units: UnitRow[] }>();
    for (const u of units) {
      if (u.currentHolderType !== 'location' || !u.currentLocation) continue;
      const key = u.currentLocation.id;
      if (!map.has(key)) map.set(key, { location: u.currentLocation, units: [] });
      map.get(key)!.units.push(u);
    }
    return [...map.values()].sort((a, b) => a.location.name.localeCompare(b.location.name));
  }, [units]);

  const heldUnits = useMemo(
    () => units.filter((u) => u.currentHolderType !== 'location'),
    [units],
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}>
          <ArrowLeftCircle className="h-4 w-4 mr-1.5" /> Back to inventory
        </Button>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Distribution</h1>
        <p className="text-sm text-muted-foreground">
          Where every asset is, how much consumable stock is on hand, and who received it.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'by-location', label: 'By location' },
          { key: 'stock',       label: 'Consumable stock' },
          { key: 'issued',      label: 'Issued to' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All locations</option>
          {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
        </select>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === 'by-location' ? (
        <>
          {unitsByLocation.length === 0 && heldUnits.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                No units to display.
              </CardContent>
            </Card>
          ) : (
            <>
              {unitsByLocation.map(({ location, units: rows }) => (
                <Card key={location.id}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-primary" />
                      {location.name}
                      <Badge variant="outline" className="ml-2 text-xs">{rows.length} units</Badge>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Tag</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Category</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((u) => (
                          <tr key={u.id}>
                            <td className="px-3 py-1.5 font-mono text-xs">
                              <Link href={`/assets/${u.id}`} className="text-primary hover:underline">{u.assetTag}</Link>
                            </td>
                            <td className="px-3 py-1.5">{u.name}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{u.category?.name ?? '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{u.status.replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              ))}

              {heldUnits.length > 0 && (
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Users2 className="h-4 w-4 text-primary" />
                      Held (out of stock rooms)
                      <Badge variant="outline" className="ml-2 text-xs">{heldUnits.length} units</Badge>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Tag</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Holder</th>
                          <th className="px-3 py-2 text-left">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {heldUnits.map((u) => (
                          <tr key={u.id}>
                            <td className="px-3 py-1.5 font-mono text-xs">
                              <Link href={`/assets/${u.id}`} className="text-primary hover:underline">{u.assetTag}</Link>
                            </td>
                            <td className="px-3 py-1.5">{u.name}</td>
                            <td className="px-3 py-1.5">
                              {u.currentHolderType === 'employee'   && u.currentEmployee   ? `${u.currentEmployee.firstName} ${u.currentEmployee.lastName}` :
                               u.currentHolderType === 'department' && u.currentDepartment ? u.currentDepartment.name :
                               '—'}
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground">
                              {u.currentHolderType === 'employee'
                                ? <><Users2 className="inline h-3 w-3 mr-1" />Employee</>
                                : <><Building2 className="inline h-3 w-3 mr-1" />Department</>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      ) : tab === 'stock' ? (
        stock.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
            No consumable stock yet.
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Location</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Min</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stock.map((s) => {
                    const low = s.minQuantity != null && s.quantity <= s.minQuantity;
                    return (
                      <tr key={s.id} className={cn(low && 'bg-warning/10')}>
                        <td className="px-4 py-2">{s.category?.name ?? ''}</td>
                        <td className="px-4 py-2 text-muted-foreground">{s.location?.name ?? ''}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{s.quantity}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{s.minQuantity ?? '—'}</td>
                        <td className="px-4 py-2">
                          {low ? (
                            <Badge variant="outline" className="border-warning text-warning">Low</Badge>
                          ) : (
                            <Badge variant="outline" className="border-success text-success">OK</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      ) : (
        issued.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
            No consumable issuances recorded yet.
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">When</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-left">From</th>
                    <th className="px-4 py-2 text-left">To</th>
                    <th className="px-4 py-2 text-left">By</th>
                    <th className="px-4 py-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {issued.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(i.performedAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{i.category.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{i.quantity}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        <PackageOpen className="inline h-3 w-3 mr-1" />
                        {i.fromLocation?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        {i.toHolderType === 'employee'   && i.toEmployee   ? (<><Users2 className="inline h-3 w-3 mr-1" />{i.toEmployee.firstName} {i.toEmployee.lastName}</>) :
                         i.toHolderType === 'department' && i.toDepartment ? (<><Building2 className="inline h-3 w-3 mr-1" />{i.toDepartment.name}</>) :
                         i.toHolderType === 'location'   && i.toLocation   ? (<><MapPin className="inline h-3 w-3 mr-1" />{i.toLocation.name}</>) :
                         '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {i.performer ? `${i.performer.firstName} ${i.performer.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{i.note ?? ''}</td>
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
