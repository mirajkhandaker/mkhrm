'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Ban, Pencil, Wallet, Lock, HandCoins } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApprovalTimeline, ApprovalTimelineProps } from '@/components/approvals/approval-timeline';
import { AttachmentList } from '@/components/attachments/attachment-list';
import { AttachmentUploader, StagedAttachment } from '@/components/attachments/attachment-uploader';
import { ChangeHistoryTimeline } from '@/components/changes/change-history-timeline';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

interface TravelRequestItem {
  id: string;
  description: string;
  category: string;
  transportMode: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  isRoundTrip: boolean;
  fromDate: string;
  toDate: string;
  estimatedCost: number;
  actualCost: number | null;
  isPlanned: boolean;
  note: string | null;
}

function formatRoute(item: TravelRequestItem) {
  if (!item.fromLocation && !item.toLocation) return '—';
  const route = `${item.fromLocation ?? '?'} → ${item.toLocation ?? '?'}`;
  return item.isRoundTrip ? `${route} (round trip)` : route;
}

function formatDateRange(fromDate: string, toDate: string) {
  const from = new Date(fromDate).toLocaleDateString();
  if (fromDate === toDate) return from;
  return `${from} – ${new Date(toDate).toLocaleDateString()}`;
}

interface ApprovalBlock {
  currentStep: number;
  status: ApprovalTimelineProps['status'];
  workflow?: { steps: ApprovalTimelineProps['steps'] };
  actions: ApprovalTimelineProps['actions'];
}

interface TravelRequest {
  id: string;
  purpose: string;
  timing: 'pre_trip' | 'post_trip';
  fromDate: string;
  toDate: string;
  estimatedCost: number;
  advanceRequested: number;
  approvedAdvanceAmount: number | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'reimbursed';
  settlementStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'locked';
  actualCost: number | null;
  netAdjustment: number | null;
  reimbursedAt: string | null;
  reimbursementRef: string | null;
  updatedAt: string;
  items: TravelRequestItem[];
  employee?: { firstName: string; lastName: string };
  approval?: ApprovalBlock | null;
  settlementApproval?: ApprovalBlock | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft:      'border-border text-muted-foreground',
  pending:    'border-warning text-warning bg-warning/5',
  approved:   'border-success text-success bg-success/5',
  rejected:   'border-danger text-danger bg-danger/5',
  cancelled:  'border-border text-muted-foreground',
  reimbursed: 'border-info text-info bg-info/5',
};

const SETTLEMENT_STYLES: Record<string, string> = {
  pending:  'border-warning text-warning bg-warning/5',
  approved: 'border-success text-success bg-success/5',
  rejected: 'border-danger text-danger bg-danger/5',
  locked:   'border-info text-info bg-info/5',
};

const CATEGORY_LABEL: Record<string, string> = {
  travel: 'Transport', lodging: 'Lodging', meals: 'Meals', misc: 'Misc',
};

interface SettlementRow {
  itemId: string;
  description: string;
  estimatedCost: number;
  actualCost: number;
  note: string;
  attachments: StagedAttachment[];
}

export default function TravelRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [trip, setTrip] = useState<TravelRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [locking, setLocking] = useState(false);
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlementRows, setSettlementRows] = useState<SettlementRow[]>([]);
  const [settlementSubmitting, setSettlementSubmitting] = useState(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [reimbursementRef, setReimbursementRef] = useState('');
  const [reimbursing, setReimbursing] = useState(false);
  const [reimburseError, setReimburseError] = useState<string | null>(null);

  const load = useCallback(() => {
    return api.get<TravelRequest>(`/travel/${id}`)
      .then((data) => {
        setTrip(data);
        setSettlementRows(
          data.items.map((item) => ({
            itemId: item.id,
            description: item.description,
            estimatedCost: Number(item.estimatedCost),
            actualCost: item.actualCost != null ? Number(item.actualCost) : Number(item.estimatedCost),
            note: item.note ?? '',
            attachments: [],
          })),
        );
      })
      .catch((e: ApiError) => setError(e.message));
  }, [id]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function handleCancel() {
    if (!confirm('Cancel this travel request? This cannot be undone.')) return;
    setCancelling(true);
    try {
      await api.delete(`/travel/${id}`);
      router.push('/travel');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }

  async function handleReimburse() {
    if (!reimbursementRef.trim()) {
      setReimburseError('Enter a reference before marking reimbursed');
      return;
    }
    setReimbursing(true);
    setReimburseError(null);
    try {
      await api.post(`/travel/${id}/reimburse`, { reimbursementRef: reimbursementRef.trim() });
      await load();
    } catch (err: unknown) {
      setReimburseError((err as ApiError).message ?? 'Failed to mark reimbursed');
    } finally {
      setReimbursing(false);
    }
  }

  async function handleLock() {
    if (!confirm('Lock this settlement? Any further change will require going through approval again.')) return;
    setLocking(true);
    try {
      await api.post(`/travel/${id}/settlement/lock`);
      await load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to lock settlement');
    } finally {
      setLocking(false);
    }
  }

  function updateSettlementRow(itemId: string, patch: Partial<SettlementRow>) {
    setSettlementRows((prev) => prev.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)));
  }

  async function handleSubmitSettlement() {
    setSettlementSubmitting(true);
    setSettlementError(null);
    try {
      await api.patch(`/travel/${id}/settlement`, {
        items: settlementRows.map((r) => ({
          itemId: r.itemId,
          actualCost: Number(r.actualCost) || 0,
          note: r.note || undefined,
          attachments: r.attachments.length ? r.attachments : undefined,
        })),
      });
      setShowSettlementForm(false);
      await load();
    } catch (err: unknown) {
      setSettlementError((err as ApiError).message ?? 'Failed to submit settlement');
    } finally {
      setSettlementSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="p-6">
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error ?? 'Travel request not found'}</CardContent>
        </Card>
      </div>
    );
  }

  const canCancel = ['draft', 'pending'].includes(trip.status);
  const canEdit = ['draft', 'pending', 'approved'].includes(trip.status) && trip.settlementStatus === 'none';
  const settlementNetTotal = settlementRows.reduce((sum, r) => sum + (Number(r.actualCost) || 0), 0);
  const advanceAmount = trip.approvedAdvanceAmount ?? trip.advanceRequested;

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-semibold text-foreground">{trip.purpose}</h1>
            <Badge variant="outline" className={cn('text-xs', STATUS_STYLES[trip.status] ?? '')}>
              {trip.status}
            </Badge>
            {trip.timing === 'post_trip' && (
              <Badge variant="outline" className="text-xs border-info text-info bg-info/5">
                Post-trip reimbursement
              </Badge>
            )}
            {trip.settlementStatus !== 'none' && (
              <Badge variant="outline" className={cn('text-xs', SETTLEMENT_STYLES[trip.settlementStatus] ?? '')}>
                {trip.settlementStatus === 'locked' ? 'Settled' : `Settlement ${trip.settlementStatus}`}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(trip.fromDate).toLocaleDateString()} – {new Date(trip.toDate).toLocaleDateString()}
            {trip.employee && ` · ${trip.employee.firstName} ${trip.employee.lastName}`}
            {trip.reimbursedAt && ` · Reimbursed ${new Date(trip.reimbursedAt).toLocaleDateString()} (ref ${trip.reimbursementRef})`}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/travel/${id}/edit`}>
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
              Cancel Trip
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journey Costs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transport</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Route</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Cost</th>
                  {trip.settlementStatus !== 'none' && (
                    <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actual Cost</th>
                  )}
                  <th className="px-5 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proof</th>
                </tr>
              </thead>
              <tbody>
                {trip.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 font-medium text-foreground">
                      {item.description}
                      {!item.isPlanned && <span className="ml-1.5 text-xs text-muted-foreground">(unplanned)</span>}
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">{CATEGORY_LABEL[item.category] ?? item.category}</td>
                    <td className="px-5 py-2.5 text-muted-foreground capitalize">{item.transportMode ?? '—'}</td>
                    <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap">{formatRoute(item)}</td>
                    <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap">{formatDateRange(item.fromDate, item.toDate)}</td>
                    <td className="px-5 py-2.5 tabular-nums">${Number(item.estimatedCost).toFixed(2)}</td>
                    {trip.settlementStatus !== 'none' && (
                      <td className={cn(
                        'px-5 py-2.5 tabular-nums',
                        item.actualCost != null && Number(item.actualCost) > Number(item.estimatedCost) && 'text-danger',
                        item.actualCost != null && Number(item.actualCost) < Number(item.estimatedCost) && 'text-success',
                      )}>
                        {item.actualCost != null ? `$${Number(item.actualCost).toFixed(2)}` : '—'}
                      </td>
                    )}
                    <td className="px-5 py-2.5">
                      <AttachmentList ownerType="travel_request_item" ownerId={item.id} emptyLabel="—" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-6 border-t border-border px-5 py-3">
            {trip.timing === 'pre_trip' && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground mr-2">Advance Requested</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">${Number(trip.advanceRequested).toFixed(2)}</span>
              </div>
            )}
            {trip.approvedAdvanceAmount != null && Number(trip.approvedAdvanceAmount) !== Number(trip.advanceRequested) && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground mr-2">{trip.timing === 'post_trip' ? 'Approved Amount' : 'Approved Advance'}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">${Number(trip.approvedAdvanceAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="text-right">
              <span className="text-xs text-muted-foreground mr-2">{trip.timing === 'post_trip' ? 'Total Cost' : 'Total Estimated Cost'}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">${Number(trip.estimatedCost).toFixed(2)}</span>
            </div>
            {trip.actualCost != null && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground mr-2">Net Adjustment</span>
                <span className={cn(
                  'text-sm font-semibold tabular-nums',
                  Number(trip.netAdjustment) > 0 ? 'text-danger' : Number(trip.netAdjustment) < 0 ? 'text-success' : 'text-foreground',
                )}>
                  {Number(trip.netAdjustment) > 0 ? '+' : ''}${Number(trip.netAdjustment).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {trip.approval?.workflow?.steps && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalTimeline
              currentStep={trip.approval.currentStep}
              status={trip.approval.status}
              steps={trip.approval.workflow.steps}
              actions={trip.approval.actions ?? []}
            />
          </CardContent>
        </Card>
      )}

      {trip.timing === 'post_trip' && (trip.status === 'approved' || trip.status === 'reimbursed') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reimbursement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reimburseError && <p className="text-sm text-danger">{reimburseError}</p>}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Approved amount</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  ${Number(trip.approvedAdvanceAmount ?? trip.estimatedCost).toFixed(2)}
                </p>
              </div>
              {trip.status === 'reimbursed' ? (
                <Badge variant="outline" className="text-xs border-info text-info bg-info/5">
                  Reimbursed {trip.reimbursedAt && new Date(trip.reimbursedAt).toLocaleDateString()} (ref {trip.reimbursementRef})
                </Badge>
              ) : hasPermission('travel.reimburse') ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Reference (e.g. TXN-1234)"
                    value={reimbursementRef}
                    onChange={(e) => setReimbursementRef(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <Button size="sm" disabled={reimbursing} onClick={handleReimburse}>
                    {reimbursing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <HandCoins className="h-3.5 w-3.5 mr-1.5" />}
                    Mark Reimbursed
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Awaiting reimbursement from Finance.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {trip.timing === 'pre_trip' && trip.status === 'approved' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Settlement</CardTitle>
            <div className="flex gap-2">
              {trip.settlementStatus === 'approved' && hasPermission('travel.settle') && (
                <Button size="sm" variant="outline" disabled={locking} onClick={handleLock}>
                  {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Lock className="h-3.5 w-3.5 mr-1.5" />}
                  Lock Settlement
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowSettlementForm((s) => !s)}>
                <Wallet className="h-3.5 w-3.5 mr-1.5" />
                {trip.settlementStatus === 'none' ? 'File Settlement' : 'Submit Adjustment'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {trip.settlementStatus === 'locked' && (
              <p className="text-xs text-muted-foreground">
                This settlement is locked. Submitting an adjustment will reopen it and restart approval.
              </p>
            )}

            {showSettlementForm && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                {settlementError && <p className="text-sm text-danger">{settlementError}</p>}
                {settlementRows.map((row) => (
                  <div key={row.itemId} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-3">
                      <Label className="text-xs">{row.description}</Label>
                      <p className="text-xs text-muted-foreground tabular-nums">Est. ${row.estimatedCost.toFixed(2)}</p>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Actual Cost</Label>
                      <Input
                        type="number" min={0} step={0.01}
                        value={row.actualCost}
                        onChange={(e) => updateSettlementRow(row.itemId, { actualCost: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">Note</Label>
                      <Input
                        value={row.note}
                        onChange={(e) => updateSettlementRow(row.itemId, { note: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Proof</Label>
                      <AttachmentUploader
                        value={row.attachments}
                        onChange={(files) => updateSettlementRow(row.itemId, { attachments: files })}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground mr-2">Net Adjustment</span>
                    <span className="font-semibold tabular-nums">
                      {(settlementNetTotal - Number(advanceAmount)) > 0 ? '+' : ''}
                      ${(settlementNetTotal - Number(advanceAmount)).toFixed(2)}
                    </span>
                  </div>
                  <Button size="sm" disabled={settlementSubmitting} onClick={handleSubmitSettlement}>
                    {settlementSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Submit Settlement
                  </Button>
                </div>
              </div>
            )}

            {trip.settlementApproval?.workflow?.steps && (
              <ApprovalTimeline
                currentStep={trip.settlementApproval.currentStep}
                status={trip.settlementApproval.status}
                steps={trip.settlementApproval.workflow.steps}
                actions={trip.settlementApproval.actions ?? []}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change History</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeHistoryTimeline key={trip.updatedAt} path={`/travel/${id}/changes`} />
        </CardContent>
      </Card>
    </div>
  );
}
