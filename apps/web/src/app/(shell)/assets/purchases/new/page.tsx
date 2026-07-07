'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftCircle, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CategoryOption { id: string; name: string; code: string; trackingMode: string }
interface LocationOption { id: string; name: string; code: string }

interface ItemRow {
  categoryId: string;
  quantity: string;
  unitCost: string;
  locationId: string;
  warrantyMonths: string;
  note: string;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const [vendor, setVendor] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [linkedRequisitionId, setLinkedRequisitionId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemRow[]>([
    { categoryId: '', quantity: '1', unitCost: '', locationId: '', warrantyMonths: '', note: '' },
  ]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<CategoryOption[]>('/assets/categories'),
      api.get<LocationOption[]>('/assets/locations'),
    ]).then(([c, l]) => { setCategories(c); setLocations(l); }).catch((e: ApiError) => setError(e.message));
  }, []);

  const total = items.reduce((sum, i) => sum + (Number(i.quantity || 0) * Number(i.unitCost || 0)), 0);

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  async function submit() {
    setError(null);
    if (!vendor || !invoiceDate) { setError('Vendor and invoice date are required'); return; }
    if (items.some((i) => !i.categoryId || !i.locationId || !i.quantity || !i.unitCost)) {
      setError('Each item needs a category, location, quantity and unit cost'); return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ id: string }>('/assets/purchases', {
        vendor,
        invoiceNo: invoiceNo || undefined,
        invoiceDate,
        linkedRequisitionId: linkedRequisitionId || undefined,
        notes: notes || undefined,
        items: items.map((i) => ({
          categoryId: i.categoryId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          locationId: i.locationId,
          warrantyMonths: i.warrantyMonths ? Number(i.warrantyMonths) : undefined,
          note: i.note || undefined,
        })),
      });
      router.push(`/assets/purchases/${res.id}`);
    } catch (err: unknown) { setError((err as ApiError).message ?? 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets/purchases')}>
          <ArrowLeftCircle className="h-4 w-4 mr-1.5" /> Back to purchases
        </Button>
      </div>
      <h1 className="font-display text-2xl font-semibold">New Purchase</h1>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}

      <Card><CardContent className="pt-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Vendor
            <input value={vendor} onChange={(e) => setVendor(e.target.value)}
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </label>
          <label className="text-sm">Invoice #
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </label>
          <label className="text-sm">Invoice date
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </label>
          <label className="text-sm">Linked requisition (optional)
            <input value={linkedRequisitionId} onChange={(e) => setLinkedRequisitionId(e.target.value)}
              placeholder="Requisition UUID (leave blank for walk-in)"
              className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm" />
          </label>
        </div>
        <label className="text-sm block">Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
      </CardContent></Card>

      <Card><CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Items</h2>
          <Button size="sm" variant="outline" onClick={() =>
            setItems((prev) => [...prev, { categoryId: '', quantity: '1', unitCost: '', locationId: '', warrantyMonths: '', note: '' }])}>
            <PlusCircle className="h-4 w-4 mr-1.5" /> Add item
          </Button>
        </div>
        {items.map((row, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start pt-2 border-t border-border first:border-t-0 first:pt-0">
            <select value={row.categoryId} onChange={(e) => updateItem(idx, { categoryId: e.target.value })}
              className="col-span-3 h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Category</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.trackingMode})</option>))}
            </select>
            <input type="number" min="1" placeholder="Qty" value={row.quantity}
              onChange={(e) => updateItem(idx, { quantity: e.target.value })}
              className="col-span-1 h-9 rounded-md border border-input bg-background px-2 text-sm" />
            <input type="number" min="0" step="0.01" placeholder="Unit cost" value={row.unitCost}
              onChange={(e) => updateItem(idx, { unitCost: e.target.value })}
              className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm" />
            <select value={row.locationId} onChange={(e) => updateItem(idx, { locationId: e.target.value })}
              className="col-span-3 h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Location</option>
              {locations.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
            <input type="number" placeholder="Warranty mo." value={row.warrantyMonths}
              onChange={(e) => updateItem(idx, { warrantyMonths: e.target.value })}
              className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm" />
            <Button size="icon" variant="ghost" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="col-span-1 text-danger">
              <Trash2 className="h-4 w-4" />
            </Button>
            <input placeholder="Note (optional)" value={row.note}
              onChange={(e) => updateItem(idx, { note: e.target.value })}
              className="col-span-12 h-9 rounded-md border border-input bg-background px-2 text-sm" />
          </div>
        ))}
        <div className="text-right text-sm text-muted-foreground pt-2 border-t border-border">
          Total: <span className="font-mono tabular-nums">${total.toFixed(2)}</span>
        </div>
      </CardContent></Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push('/assets/purchases')}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create purchase'}</Button>
      </div>
    </div>
  );
}
