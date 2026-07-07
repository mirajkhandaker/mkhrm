'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, CornerUpLeft, MessageSquare, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  ApprovalTimeline,
  ApprovalTimelineProps,
} from '@/components/approvals/approval-timeline';
import { cn } from '@/lib/utils';

interface Approval {
  id: string;
  entityType: string;
  entityId: string;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  createdAt: string;
  requester?: { email: string };
  workflow?: { steps: ApprovalTimelineProps['steps'] };
  actions: ApprovalTimelineProps['actions'];
}

interface RequestedAmountEntity {
  advanceRequested?: number;
  actualCost?: number;
  totalAmount?: number;
  estimatedCost?: number;
  timing?: 'pre_trip' | 'post_trip';
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  leave:              'Leave Request',
  requisition:        'Requisition',
  travel_request:     'Travel Request',
  travel_settlement:  'Travel Settlement',
  expense_claim:      'Expense Claim',
  regularization:     'Regularization',
};

// Entity types where an approver can approve a different amount than requested (audit/
// finance discretion) — the underlying entity is fetched on expand so the approver can
// see what was actually requested before typing an override.
const AMOUNT_ENTITY_TYPES = ['travel_request', 'travel_settlement', 'expense_claim'];

const STATUS_BADGE: Record<string, string> = {
  pending:   'border-warning text-warning',
  approved:  'border-success text-success',
  rejected:  'border-danger text-danger',
  cancelled: 'border-border text-muted-foreground',
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, Approval>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [requestedAmounts, setRequestedAmounts] = useState<Record<string, number>>({});
  const [approvedAmountInputs, setApprovedAmountInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<Approval[]>('/approvals/mine')
      .then(setApprovals)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadDetail(id: string) {
    if (detail[id]) return;
    const d = await api.get<Approval>(`/approvals/${id}`);
    setDetail((prev) => ({ ...prev, [id]: d }));

    if (AMOUNT_ENTITY_TYPES.includes(d.entityType)) {
      try {
        const path = d.entityType === 'expense_claim' ? `/expenses/${d.entityId}` : `/travel/${d.entityId}`;
        const entity = await api.get<RequestedAmountEntity>(path);
        // A post-trip travel request never carries an advance — the amount being asked
        // for is its total cost, to be reimbursed directly once approved.
        const amount = d.entityType === 'expense_claim'
          ? entity.totalAmount
          : d.entityType === 'travel_settlement'
            ? entity.actualCost
            : d.entityType === 'travel_request' && entity.timing === 'post_trip'
              ? entity.estimatedCost
              : entity.advanceRequested;
        if (amount != null) {
          setRequestedAmounts((prev) => ({ ...prev, [id]: Number(amount) }));
          setApprovedAmountInputs((prev) => ({ ...prev, [id]: String(Number(amount)) }));
        }
      } catch {
        // Non-fatal — the approver can still act without the requested-amount context.
      }
    }
  }

  function toggleExpand(id: string) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next) loadDetail(next);
  }

  async function act(approvalId: string, action: string) {
    setActing(action + approvalId);
    try {
      const body: Record<string, unknown> = { action, comment: comment || undefined };
      if (action === 'approve' && requestedAmounts[approvalId] != null) {
        const inputVal = Number(approvedAmountInputs[approvalId]);
        if (!Number.isNaN(inputVal) && inputVal !== requestedAmounts[approvalId]) {
          body.approvedAmount = inputVal;
        }
      }
      await api.post(`/approvals/${approvalId}/act`, body);
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      setExpanded(null);
      setComment('');
    } catch (err: unknown) {
      alert((err as ApiError).message ?? 'Action failed');
    } finally {
      setActing(null);
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
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">My Approvals</h1>
        <p className="text-sm text-muted-foreground">Pending requests routed to you for action</p>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {!loading && approvals.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <CheckCircle className="h-10 w-10 text-success" />
            <p className="font-medium text-foreground">All caught up</p>
            <p className="text-sm text-muted-foreground">
              No pending approvals need your attention right now.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {approvals.map((appr) => {
          const isOpen = expanded === appr.id;
          const det = detail[appr.id] ?? appr;
          const isActing = (s: string) => acting === s + appr.id;
          const hasAmountContext = requestedAmounts[appr.id] != null;

          return (
            <Card key={appr.id} className="overflow-hidden">
              <button
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(appr.id)}
                aria-expanded={isOpen}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-foreground text-sm">
                      {ENTITY_TYPE_LABEL[appr.entityType] ?? appr.entityType}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', STATUS_BADGE[appr.status] ?? '')}
                    >
                      {appr.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {appr.requester?.email ?? appr.requestedBy}
                    {' · '}
                    {new Date(appr.createdAt).toLocaleDateString()}
                    {' · Step '}
                    {appr.currentStep}
                  </p>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-border px-5 py-4 space-y-4">
                  {/* Timeline */}
                  {det.workflow?.steps && (
                    <ApprovalTimeline
                      currentStep={det.currentStep}
                      status={det.status}
                      steps={det.workflow.steps}
                      actions={det.actions ?? []}
                    />
                  )}

                  {/* Action panel */}
                  {appr.status === 'pending' && (
                    <div className="space-y-3 pt-2">
                      {hasAmountContext && (
                        <div className="max-w-[200px] space-y-1">
                          <Label className="text-xs">
                            Approved amount <span className="text-muted-foreground">(requested ${requestedAmounts[appr.id].toFixed(2)})</span>
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={approvedAmountInputs[appr.id] ?? ''}
                            onChange={(e) => setApprovedAmountInputs((prev) => ({ ...prev, [appr.id]: e.target.value }))}
                          />
                        </div>
                      )}
                      <Textarea
                        placeholder="Optional comment…"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90 text-white"
                          disabled={!!acting}
                          onClick={() => act(appr.id, 'approve')}
                        >
                          {isActing('approve') ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-danger text-danger hover:bg-danger/10"
                          disabled={!!acting}
                          onClick={() => act(appr.id, 'reject')}
                        >
                          {isActing('reject') ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                          )}
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-warning text-warning hover:bg-warning/10"
                          disabled={!!acting}
                          onClick={() => act(appr.id, 'return')}
                        >
                          {isActing('return') ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <CornerUpLeft className="h-3.5 w-3.5 mr-1" />
                          )}
                          Return
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!acting || !comment}
                          onClick={() => act(appr.id, 'comment')}
                        >
                          {isActing('comment') ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          )}
                          Comment
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
