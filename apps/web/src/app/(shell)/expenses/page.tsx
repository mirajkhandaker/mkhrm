'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  Wallet,
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

interface ExpenseClaim {
  id: string;
  title: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  items: Array<{ id: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  draft:      'border-border text-muted-foreground',
  pending:    'border-warning text-warning bg-warning/5',
  approved:   'border-success text-success bg-success/5',
  rejected:   'border-danger text-danger bg-danger/5',
  cancelled:  'border-border text-muted-foreground',
  reimbursed: 'border-info text-info bg-info/5',
};

const STATUS_ICON: Record<string, React.FC<{ className?: string }>> = {
  pending:    Clock,
  approved:   CheckCircle,
  rejected:   XCircle,
  cancelled:  Ban,
  reimbursed: Wallet,
};

export default function ExpensesPage() {
  const { hasPermission } = useAuth();
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function load() {
    api.get<ExpenseClaim[]>('/expenses')
      .then(setClaims)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id: string) {
    if (!confirm('Cancel this expense claim? This cannot be undone.')) return;
    setCancellingId(id);
    setError(null);
    try {
      await api.delete(`/expenses/${id}`);
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
          <h1 className="font-display text-2xl font-semibold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">Post-trip expense claims, one or more line items per claim</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('expense.reimburse') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/expenses/reimbursement">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Reimbursement
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/expenses/new">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              New Expense Claim
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No expense claims yet</p>
            <p className="text-sm text-muted-foreground">File a claim with your receipts to get reimbursed.</p>
            <Button size="sm" asChild className="mt-1">
              <Link href="/expenses/new">New Expense Claim</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => {
            const Icon = STATUS_ICON[c.status] ?? Clock;
            const canCancel = ['draft', 'pending'].includes(c.status);
            return (
              <Card key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                <Link href={`/expenses/${c.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{c.title}</span>
                    <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[c.status] ?? '')}>
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.items?.length ?? 0} {c.items?.length === 1 ? 'item' : 'items'}
                    {' · '}
                    <span className="tabular-nums">{c.currency} {Number(c.totalAmount).toFixed(2)}</span>
                  </p>
                </Link>
                {canCancel && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10 hover:text-danger flex-shrink-0"
                    disabled={cancellingId === c.id}
                    onClick={() => handleCancel(c.id)}
                    aria-label="Cancel expense claim"
                  >
                    {cancellingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Icon
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    c.status === 'approved' ? 'text-success' :
                    c.status === 'reimbursed' ? 'text-info' :
                    c.status === 'rejected' ? 'text-danger' :
                    c.status === 'cancelled' ? 'text-muted-foreground' : 'text-warning',
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
