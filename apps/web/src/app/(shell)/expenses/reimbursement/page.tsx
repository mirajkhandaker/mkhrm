'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Wallet, CheckCircle, Download } from 'lucide-react';
import { api, ApiError, downloadFile } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';

interface ExpenseClaim {
  id: string;
  title: string;
  totalAmount: number;
  currency: string;
  updatedAt: string;
  employee?: { firstName: string; lastName: string; employeeCode: string };
  items: Array<{ id: string }>;
}

export default function ReimbursementPage() {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadFile('/reports/export/expenses?format=xlsx', 'expenses.xlsx');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to export');
    } finally {
      setExporting(false);
    }
  }

  function load() {
    setLoading(true);
    api.get<ExpenseClaim[]>('/expenses/reimbursable')
      .then(setClaims)
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
      await api.post(`/expenses/${id}/reimburse`, { reimbursementRef: ref });
      setClaims((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to mark reimbursed');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Expenses', href: '/expenses' }]}
        title="Reimbursement"
        description="Approved expense claims awaiting reimbursement"
        actions={
          <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            Export
          </Button>
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
      ) : claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CheckCircle className="h-10 w-10 text-success" />
            <p className="font-medium text-foreground">Nothing to reimburse</p>
            <p className="text-sm text-muted-foreground">All approved expense claims have been settled.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => (
            <Card key={c.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <Link href={`/expenses/${c.id}`} className="font-medium text-sm text-foreground hover:text-primary">
                  {c.title}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.employee ? `${c.employee.firstName} ${c.employee.lastName} (${c.employee.employeeCode})` : '—'}
                  {' · '}
                  {c.items?.length ?? 0} {c.items?.length === 1 ? 'item' : 'items'}
                  {' · '}
                  <span className="tabular-nums font-medium text-foreground">{c.currency} {Number(c.totalAmount).toFixed(2)}</span>
                </p>
              </div>
              <Input
                placeholder="Reference (e.g. TXN-1234)"
                value={refs[c.id] ?? ''}
                onChange={(e) => setRefs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                className="max-w-[200px]"
              />
              <Button
                size="sm"
                disabled={submitting === c.id}
                onClick={() => handleReimburse(c.id)}
              >
                {submitting === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Wallet className="h-3.5 w-3.5 mr-1.5" />
                )}
                Mark Reimbursed
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
