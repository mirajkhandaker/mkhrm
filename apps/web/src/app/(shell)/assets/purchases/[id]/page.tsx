'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftCircle, Ban, Loader2, PackageCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Purchase {
  id: string;
  vendor: string;
  invoiceNo: string | null;
  invoiceDate: string;
  totalAmount: number;
  currency: string;
  status: string;
  notes: string | null;
  receivedAt: string | null;
  items: Array<{
    id: string;
    categoryId: string;
    quantity: number;
    unitCost: number;
    warrantyMonths: number | null;
    locationId: string;
    category?: { name: string };
    location?: { name: string };
    note: string | null;
  }>;
  receiver?: { firstName: string; lastName: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'border-warning text-warning bg-warning/5',
  received:  'border-success text-success bg-success/5',
  cancelled: 'border-muted-foreground text-muted-foreground',
};

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    api.get<Purchase>(`/assets/purchases/${id}`)
      .then(setPurchase).catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [id]);

  async function receive() {
    if (!confirm('Receive this purchase? Serialized items become tracked units; consumables bump stock.')) return;
    setBusy(true); setError(null);
    try { await api.post(`/assets/purchases/${id}/receive`, {}); reload(); }
    catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!confirm('Cancel this purchase?')) return;
    setBusy(true); setError(null);
    try { await api.post(`/assets/purchases/${id}/cancel`, {}); reload(); }
    catch (err: unknown) { setError((err as ApiError).message ?? 'Failed'); }
    finally { setBusy(false); }
  }

  if (loading || !purchase) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/assets/purchases')}>
        <ArrowLeftCircle className="h-4 w-4 mr-1.5" /> Back to purchases
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold">{purchase.vendor}</h1>
            <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[purchase.status] ?? '')}>{purchase.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Invoice {purchase.invoiceNo ?? '—'} · {purchase.invoiceDate} ·
            <span className="tabular-nums"> {purchase.currency} {Number(purchase.totalAmount).toFixed(2)}</span>
            {purchase.receivedAt && purchase.receiver && (
              <> · Received {new Date(purchase.receivedAt).toLocaleString()} by {purchase.receiver.firstName} {purchase.receiver.lastName}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {purchase.status === 'draft' && hasPermission('asset.purchase.receive') && (
            <Button size="sm" onClick={receive} disabled={busy}>
              <PackageCheck className="h-4 w-4 mr-1.5" /> {busy ? 'Receiving…' : 'Receive'}
            </Button>
          )}
          {purchase.status === 'draft' && hasPermission('asset.purchase.create') && (
            <Button size="sm" variant="outline" onClick={cancel} disabled={busy} className="text-danger">
              <Ban className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}

      {purchase.notes && (
        <Card><CardContent className="pt-4 text-sm">{purchase.notes}</CardContent></Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Location</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit cost</th>
              <th className="px-4 py-2 text-right">Line total</th>
              <th className="px-4 py-2 text-left">Warranty (mo)</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {purchase.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2">{it.category?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{it.location?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(it.unitCost).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{(it.quantity * Number(it.unitCost)).toFixed(2)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{it.warrantyMonths ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
