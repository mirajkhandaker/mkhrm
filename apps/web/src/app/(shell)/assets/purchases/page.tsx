'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Package, PlusCircle } from 'lucide-react';
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
  createdAt: string;
  items: Array<{ id: string }>;
  linkedRequisitionId: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'border-warning text-warning bg-warning/5',
  received:  'border-success text-success bg-success/5',
  cancelled: 'border-muted-foreground text-muted-foreground',
};

export default function AssetPurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = status ? '?status=' + status : '';
    api.get<Purchase[]>('/assets/purchases' + qs)
      .then(setPurchases)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Asset Purchases</h1>
          <p className="text-sm text-muted-foreground">Track vendor invoices and receive stock into inventory.</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/assets/purchases/new"><PlusCircle className="h-4 w-4 mr-1.5" /> New purchase</Link>
        </Button>
      </div>

      <div className="flex gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : purchases.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">No purchases yet</p>
          <p className="text-sm text-muted-foreground">Create one when a vendor invoice arrives.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground"><tr>
                <th className="px-4 py-2 text-left">Vendor</th>
                <th className="px-4 py-2 text-left">Invoice</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2"><Link href={`/assets/purchases/${p.id}`} className="text-primary hover:underline">{p.vendor}</Link></td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.invoiceNo ?? '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.invoiceDate}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{p.currency} {Number(p.totalAmount).toFixed(2)}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className={cn('text-xs', STATUS_STYLES[p.status] ?? '')}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
