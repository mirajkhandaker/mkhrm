'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plane,
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

interface TravelRequestItem {
  id: string;
  description: string;
}

interface TravelRequest {
  id: string;
  purpose: string;
  timing: 'pre_trip' | 'post_trip';
  fromDate: string;
  toDate: string;
  estimatedCost: number;
  status: string;
  settlementStatus: string;
  createdAt: string;
  items: TravelRequestItem[];
}

const SETTLEMENT_LABEL: Record<string, string> = {
  pending: 'Settlement pending',
  approved: 'Settlement approved',
  rejected: 'Settlement rejected',
  locked: 'Settled',
};

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

export default function TravelPage() {
  const { hasPermission } = useAuth();
  const [trips, setTrips] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function load() {
    api.get<TravelRequest[]>('/travel')
      .then(setTrips)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCancel(id: string) {
    if (!confirm('Cancel this travel request? This cannot be undone.')) return;
    setCancellingId(id);
    setError(null);
    try {
      await api.delete(`/travel/${id}`);
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
          <h1 className="font-display text-2xl font-semibold text-foreground">Travel</h1>
          <p className="text-sm text-muted-foreground">Pre-trip requests, one or more legs per trip</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('travel.reimburse') && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/travel/reimbursement">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Reimbursement
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/travel/new">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              New Trip
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {trips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Plane className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No travel requests yet</p>
            <p className="text-sm text-muted-foreground">Submit a trip request to get it approved before you travel.</p>
            <Button size="sm" asChild className="mt-1">
              <Link href="/travel/new">New Trip</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {trips.map((t) => {
            const Icon = STATUS_ICON[t.status] ?? Clock;
            const canCancel = ['draft', 'pending'].includes(t.status);
            const legCount = t.items?.length ?? 0;
            const descriptions = (t.items ?? []).map((i) => i.description).join(', ');
            return (
              <Card key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                <Link href={`/travel/${t.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{t.purpose}</span>
                    <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[t.status] ?? '')}>
                      {t.status}
                    </Badge>
                    {t.timing === 'post_trip' && (
                      <Badge variant="outline" className="text-xs border-info text-info bg-info/5">
                        Post-trip
                      </Badge>
                    )}
                    {t.settlementStatus && t.settlementStatus !== 'none' && (
                      <Badge variant="outline" className="text-xs border-info text-info bg-info/5">
                        {SETTLEMENT_LABEL[t.settlementStatus] ?? t.settlementStatus}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {descriptions || '—'}
                    {' · '}
                    {legCount} {legCount === 1 ? 'leg' : 'legs'}
                    {' · '}
                    {new Date(t.fromDate).toLocaleDateString()} – {new Date(t.toDate).toLocaleDateString()}
                    {' · '}
                    <span className="tabular-nums">${Number(t.estimatedCost).toFixed(2)}</span>
                  </p>
                </Link>
                {canCancel && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10 hover:text-danger flex-shrink-0"
                    disabled={cancellingId === t.id}
                    onClick={() => handleCancel(t.id)}
                    aria-label="Cancel travel request"
                  >
                    {cancellingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                  </Button>
                )}
                <Icon
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    t.status === 'approved' ? 'text-success' :
                    t.status === 'reimbursed' ? 'text-info' :
                    t.status === 'rejected' ? 'text-danger' :
                    t.status === 'cancelled' ? 'text-muted-foreground' : 'text-warning',
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
