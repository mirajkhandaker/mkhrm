'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Wallet, CheckCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';

interface TravelRequest {
  id: string;
  purpose: string;
  estimatedCost: number;
  approvedAdvanceAmount: number | null;
  updatedAt: string;
  employee?: { firstName: string; lastName: string; employeeCode: string };
  items: Array<{ id: string }>;
}

export default function TravelReimbursementPage() {
  const [trips, setTrips] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get<TravelRequest[]>('/travel/reimbursable')
      .then(setTrips)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleReimburse(id: string) {
    const ref = refs[id]?.trim();
    if (!ref) {
      setError('Enter a reference before marking reimbursed');
      return;
    }
    setSubmitting(id);
    setError(null);
    try {
      await api.post(`/travel/${id}/reimburse`, { reimbursementRef: ref });
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to mark reimbursed');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Travel', href: '/travel' }]}
        title="Reimbursement"
        description="Approved post-trip travel requests awaiting reimbursement"
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
      ) : trips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CheckCircle className="h-10 w-10 text-success" />
            <p className="font-medium text-foreground">Nothing to reimburse</p>
            <p className="text-sm text-muted-foreground">All approved post-trip travel requests have been settled.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {trips.map((t) => {
            const amount = t.approvedAdvanceAmount ?? t.estimatedCost;
            return (
              <Card key={t.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <Link href={`/travel/${t.id}`} className="font-medium text-sm text-foreground hover:text-primary">
                    {t.purpose}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.employee ? `${t.employee.firstName} ${t.employee.lastName} (${t.employee.employeeCode})` : '—'}
                    {' · '}
                    {t.items?.length ?? 0} {t.items?.length === 1 ? 'item' : 'items'}
                    {' · '}
                    <span className="tabular-nums font-medium text-foreground">${Number(amount).toFixed(2)}</span>
                  </p>
                </div>
                <Input
                  placeholder="Reference (e.g. TXN-1234)"
                  value={refs[t.id] ?? ''}
                  onChange={(e) => setRefs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  className="max-w-[200px]"
                />
                <Button
                  size="sm"
                  disabled={submitting === t.id}
                  onClick={() => handleReimburse(t.id)}
                >
                  {submitting === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Mark Reimbursed
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
