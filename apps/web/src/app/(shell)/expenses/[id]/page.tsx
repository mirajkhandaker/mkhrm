'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Ban, Pencil } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApprovalTimeline, ApprovalTimelineProps } from '@/components/approvals/approval-timeline';
import { AttachmentList } from '@/components/attachments/attachment-list';
import { ChangeHistoryTimeline } from '@/components/changes/change-history-timeline';
import { cn } from '@/lib/utils';

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  spentOn: string;
}

interface ExpenseClaim {
  id: string;
  title: string;
  totalAmount: number;
  approvedAmount: number | null;
  currency: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'reimbursed';
  reimbursedAt: string | null;
  reimbursementRef: string | null;
  items: ExpenseItem[];
  employee?: { firstName: string; lastName: string };
  approval?: {
    currentStep: number;
    status: ApprovalTimelineProps['status'];
    workflow?: { steps: ApprovalTimelineProps['steps'] };
    actions: ApprovalTimelineProps['actions'];
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft:      'border-border text-muted-foreground',
  pending:    'border-warning text-warning bg-warning/5',
  approved:   'border-success text-success bg-success/5',
  rejected:   'border-danger text-danger bg-danger/5',
  cancelled:  'border-border text-muted-foreground',
  reimbursed: 'border-info text-info bg-info/5',
};

export default function ExpenseClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<ExpenseClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    api.get<ExpenseClaim>(`/expenses/${id}`)
      .then(setClaim)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (!confirm('Cancel this expense claim? This cannot be undone.')) return;
    setCancelling(true);
    try {
      await api.delete(`/expenses/${id}`);
      router.push('/expenses');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="p-6">
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error ?? 'Expense claim not found'}</CardContent>
        </Card>
      </div>
    );
  }

  const canCancel = ['draft', 'pending'].includes(claim.status);
  const canEdit = ['draft', 'pending', 'approved'].includes(claim.status);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-semibold text-foreground">{claim.title}</h1>
            <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[claim.status] ?? '')}>
              {claim.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {claim.employee && `${claim.employee.firstName} ${claim.employee.lastName} · `}
            {claim.currency} {Number(claim.totalAmount).toFixed(2)}
            {claim.approvedAmount != null && Number(claim.approvedAmount) !== Number(claim.totalAmount) && (
              ` (approved for ${claim.currency} ${Number(claim.approvedAmount).toFixed(2)})`
            )}
            {claim.reimbursedAt && ` · Reimbursed ${new Date(claim.reimbursedAt).toLocaleDateString()} (ref ${claim.reimbursementRef})`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/expenses/${id}/edit`}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </a>
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={handleCancel}
              className="border-danger text-danger hover:bg-danger/10"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Ban className="h-3.5 w-3.5 mr-1.5" />}
              Cancel Claim
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spent On</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipts</th>
                </tr>
              </thead>
              <tbody>
                {claim.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 font-medium text-foreground">{item.description}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{new Date(item.spentOn).toLocaleDateString()}</td>
                    <td className="px-5 py-2.5 tabular-nums">${Number(item.amount).toFixed(2)}</td>
                    <td className="px-5 py-2.5">
                      <AttachmentList ownerType="expense_item" ownerId={item.id} emptyLabel="—" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-border px-5 py-3">
            <span className="text-sm text-muted-foreground mr-2">Total</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {claim.currency} {Number(claim.totalAmount).toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {claim.approval?.workflow?.steps && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalTimeline
              currentStep={claim.approval.currentStep}
              status={claim.approval.status}
              steps={claim.approval.workflow.steps}
              actions={claim.approval.actions ?? []}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change History</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeHistoryTimeline path={`/expenses/${id}/changes`} />
        </CardContent>
      </Card>
    </div>
  );
}
