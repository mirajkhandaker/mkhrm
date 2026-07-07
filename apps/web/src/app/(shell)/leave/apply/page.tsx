'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CalendarDays, Info } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layout/page-header';

interface LeaveType {
  id: string;
  name: string;
  color: string;
  isPaid: boolean;
  requiresDocument: boolean;
  allowNegativeBalance: boolean;
}

interface LeaveBalance {
  leaveTypeId: string;
  available: number;
  pending: number;
  used: number;
}

export default function ApplyLeavePage() {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    reason: '',
    documentUrl: '',
  });
  const [previewDays, setPreviewDays] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<LeaveType[]>('/leave/types'),
      api.get<LeaveBalance[]>(`/leave/balances?year=${new Date().getFullYear()}`),
    ])
      .then(([types, bals]) => { setLeaveTypes(types); setBalances(bals); })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!form.startDate || !form.endDate) { setPreviewDays(null); return; }
    if (new Date(form.endDate) < new Date(form.startDate)) { setPreviewDays(null); return; }
    setPreviewLoading(true);
    api.get<{ days: number }>(
      `/leave/preview-days?startDate=${form.startDate}&endDate=${form.endDate}&isHalfDay=${form.isHalfDay}`,
    )
      .then((r) => setPreviewDays(r.days))
      .catch(() => setPreviewDays(null))
      .finally(() => setPreviewLoading(false));
  }, [form.startDate, form.endDate, form.isHalfDay]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leaveTypeId || !form.startDate || !form.endDate) {
      setError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/leave/applications', {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        isHalfDay: form.isHalfDay,
        reason: form.reason || undefined,
        documentUrl: form.documentUrl || undefined,
      });
      router.push('/leave');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType = leaveTypes.find((t) => t.id === form.leaveTypeId);
  const selectedBalance = balances.find((b) => b.leaveTypeId === form.leaveTypeId);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <PageHeader
        breadcrumb={[{ label: 'Leave', href: '/leave' }]}
        title="Apply for Leave"
        description="Submit a leave request for approval"
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Leave Type */}
        <div className="space-y-1.5">
          <Label htmlFor="leaveTypeId">Leave Type <span className="text-danger">*</span></Label>
          <select
            id="leaveTypeId"
            value={form.leaveTypeId}
            onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
            className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="">Select leave type…</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Balance info */}
        {selectedBalance && (
          <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm">
            <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-foreground">
                {Number(selectedBalance.available).toFixed(1)} days available
              </span>
              <span className="text-muted-foreground">
                {' '}· {Number(selectedBalance.used).toFixed(1)} used
                {Number(selectedBalance.pending) > 0 && ` · ${Number(selectedBalance.pending).toFixed(1)} pending`}
              </span>
              {selectedType?.requiresDocument && (
                <p className="mt-1 text-warning">A supporting document is required for this leave type.</p>
              )}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start Date <span className="text-danger">*</span></Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">End Date <span className="text-danger">*</span></Label>
            <Input
              id="endDate"
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>

        {/* Half day */}
        <div className="flex items-center gap-2">
          <input
            id="isHalfDay"
            type="checkbox"
            checked={form.isHalfDay}
            onChange={(e) => setForm((f) => ({ ...f, isHalfDay: e.target.checked }))}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <Label htmlFor="isHalfDay" className="cursor-pointer">Half day</Label>
        </div>

        {/* Day preview */}
        {(form.startDate && form.endDate) && (
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {previewLoading ? (
              <span className="text-muted-foreground">Calculating…</span>
            ) : previewDays !== null ? (
              <span className="text-foreground font-medium">
                {previewDays.toFixed(1)} working {previewDays === 1 ? 'day' : 'days'}
              </span>
            ) : null}
          </div>
        )}

        {/* Reason */}
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            placeholder="Optional: describe the reason for this leave…"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Document URL (shown when required) */}
        {selectedType?.requiresDocument && (
          <div className="space-y-1.5">
            <Label htmlFor="documentUrl">Document URL <span className="text-danger">*</span></Label>
            <Input
              id="documentUrl"
              type="url"
              placeholder="https://…"
              value={form.documentUrl}
              onChange={(e) => setForm((f) => ({ ...f, documentUrl: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Upload the document and paste the URL here.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Submit Application
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
