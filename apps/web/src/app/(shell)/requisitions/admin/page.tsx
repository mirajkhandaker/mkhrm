'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShoppingCart } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

interface Requisition {
  id: string;
  type: string;
  title: string;
  priority: string;
  estimatedCost: number;
  status: string;
  createdAt: string;
  requester?: { firstName: string; lastName: string; employeeCode: string };
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'border-border text-muted-foreground',
  pending:   'border-warning text-warning bg-warning/5',
  approved:  'border-success text-success bg-success/5',
  rejected:  'border-danger text-danger bg-danger/5',
  cancelled: 'border-border text-muted-foreground',
};

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'cancelled'];

export default function RequisitionsAdminPage() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const query = status === 'all' ? '' : `?status=${status}`;
    api.get<Requisition[]>(`/requisitions/all${query}`)
      .then(setRequisitions)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Requisitions', href: '/requisitions' }]}
        title="All Requisitions"
        description="Org-wide asset, purchase and recruitment requests"
        actions={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-9 rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
            ))}
          </select>
        }
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requisitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No requisitions found</p>
            <p className="text-sm text-muted-foreground">Nothing matches this filter yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requester</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((req) => (
                  <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/requisitions/${req.id}`} className="font-medium text-foreground hover:text-primary">
                        {req.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {req.requester ? `${req.requester.firstName} ${req.requester.lastName}` : '—'}
                    </td>
                    <td className="px-5 py-3 capitalize">{req.type}</td>
                    <td className="px-5 py-3 capitalize">{req.priority}</td>
                    <td className="px-5 py-3 tabular-nums">${Number(req.estimatedCost).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[req.status] ?? '')}>
                        {req.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
