'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  Loader2,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Requisition {
  id: string;
  type: string;
  title: string;
  priority: string;
  estimatedCost: number;
  status: string;
  createdAt: string;
  items: Array<{ id: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'border-border text-muted-foreground',
  pending:   'border-warning text-warning bg-warning/5',
  approved:  'border-success text-success bg-success/5',
  rejected:  'border-danger text-danger bg-danger/5',
  cancelled: 'border-border text-muted-foreground',
};

const STATUS_ICON: Record<string, React.FC<{ className?: string }>> = {
  pending:   Clock,
  approved:  CheckCircle,
  rejected:  XCircle,
  cancelled: Ban,
};

const TYPE_LABEL: Record<string, string> = {
  asset: 'Asset',
  purchase: 'Purchase',
  recruitment: 'Recruitment',
};

export default function RequisitionsPage() {
  const { hasPermission } = useAuth();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function load() {
    api.get<Requisition[]>('/requisitions')
      .then(setRequisitions)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id: string) {
    if (!confirm('Cancel this requisition? This cannot be undone.')) return;
    setCancellingId(id);
    setError(null);
    try {
      await api.delete(`/requisitions/${id}`);
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Requisitions</h1>
          <p className="text-sm text-muted-foreground">Asset, purchase and recruitment requests</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('requisition.approve') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/requisitions/admin">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                All Requisitions
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/requisitions/new">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              New Requisition
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {!error && requisitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No requisitions yet</p>
            <p className="text-sm text-muted-foreground">Submit an asset, purchase or recruitment request to get started.</p>
            <Button size="sm" asChild className="mt-1">
              <Link href="/requisitions/new">New Requisition</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requisitions.map((req) => {
            const Icon = STATUS_ICON[req.status] ?? Clock;
            const canCancel = ['draft', 'pending'].includes(req.status);
            return (
              <Card key={req.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                <Link href={`/requisitions/${req.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{req.title}</span>
                    <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[req.status] ?? '')}>
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {TYPE_LABEL[req.type] ?? req.type}
                    {' · '}
                    {req.items?.length ?? 0} {req.items?.length === 1 ? 'item' : 'items'}
                    {' · '}
                    <span className="tabular-nums">${Number(req.estimatedCost).toFixed(2)}</span>
                    {' · '}
                    {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                {canCancel && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10 hover:text-danger flex-shrink-0"
                    disabled={cancellingId === req.id}
                    onClick={() => handleCancel(req.id)}
                    aria-label="Cancel requisition"
                  >
                    {cancellingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Icon
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    req.status === 'approved' ? 'text-success' :
                    req.status === 'rejected' ? 'text-danger' :
                    req.status === 'cancelled' ? 'text-muted-foreground' :
                    'text-warning',
                  )}
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
