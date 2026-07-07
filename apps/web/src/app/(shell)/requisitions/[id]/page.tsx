'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Ban } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApprovalTimeline, ApprovalTimelineProps } from '@/components/approvals/approval-timeline';
import { getRequisitionTypeCopy } from '@/lib/requisition-copy';
import { cn } from '@/lib/utils';

interface RequisitionItem {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  note: string | null;
}

interface Requisition {
  id: string;
  type: string;
  title: string;
  description: string | null;
  priority: string;
  neededBy: string | null;
  estimatedCost: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  items: RequisitionItem[];
  requester?: { firstName: string; lastName: string; employeeCode: string };
  approval?: {
    currentStep: number;
    status: ApprovalTimelineProps['status'];
    workflow?: { steps: ApprovalTimelineProps['steps'] };
    actions: ApprovalTimelineProps['actions'];
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'border-border text-muted-foreground',
  pending:   'border-warning text-warning bg-warning/5',
  approved:  'border-success text-success bg-success/5',
  rejected:  'border-danger text-danger bg-danger/5',
  cancelled: 'border-border text-muted-foreground',
};

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    api.get<Requisition>(`/requisitions/${id}`)
      .then(setRequisition)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (!confirm('Cancel this requisition? This cannot be undone.')) return;
    setCancelling(true);
    try {
      await api.delete(`/requisitions/${id}`);
      router.push('/requisitions');
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

  if (error || !requisition) {
    return (
      <div className="p-6">
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error ?? 'Requisition not found'}</CardContent>
        </Card>
      </div>
    );
  }

  const canCancel = ['draft', 'pending'].includes(requisition.status);
  const copy = getRequisitionTypeCopy(requisition.type);

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-semibold text-foreground">{requisition.title}</h1>
            <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[requisition.status] ?? '')}>
              {requisition.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {requisition.type} · {requisition.priority} priority
            {requisition.requester && ` · ${requisition.requester.firstName} ${requisition.requester.lastName}`}
            {requisition.neededBy && ` · Needed by ${new Date(requisition.neededBy).toLocaleDateString()}`}
          </p>
        </div>
        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            disabled={cancelling}
            onClick={handleCancel}
            className="border-danger text-danger hover:bg-danger/10"
          >
            {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Ban className="h-3.5 w-3.5 mr-1.5" />}
            Cancel Requisition
          </Button>
        )}
      </div>

      {requisition.description && (
        <p className="text-sm text-muted-foreground">{requisition.description}</p>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.itemsLabel}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{copy.itemNameLabel}</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{copy.qtyLabel}</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{copy.unitCostLabel}</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subtotal</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{copy.noteLabel}</th>
                </tr>
              </thead>
              <tbody>
                {requisition.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 font-medium text-foreground">{item.name}</td>
                    <td className="px-5 py-2.5 tabular-nums">{item.quantity}</td>
                    <td className="px-5 py-2.5 tabular-nums">${Number(item.unitCost).toFixed(2)}</td>
                    <td className="px-5 py-2.5 tabular-nums">${(item.quantity * Number(item.unitCost)).toFixed(2)}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{item.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t border-border px-5 py-3">
            <span className="text-sm text-muted-foreground mr-2">{copy.totalLabel}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              ${Number(requisition.estimatedCost).toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Approval timeline */}
      {requisition.approval?.workflow?.steps && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalTimeline
              currentStep={requisition.approval.currentStep}
              status={requisition.approval.status}
              steps={requisition.approval.workflow.steps}
              actions={requisition.approval.actions ?? []}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
