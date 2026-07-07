'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { AttachmentUploader, StagedAttachment } from '@/components/attachments/attachment-uploader';

interface TravelRequest {
  id: string;
  purpose: string;
  fromDate: string;
  toDate: string;
}

interface ItemRow {
  description: string;
  amount: number;
  spentOn: string;
  attachments: StagedAttachment[];
}

const EMPTY_ITEM: ItemRow = {
  description: '',
  amount: 0,
  spentOn: new Date().toISOString().slice(0, 10),
  attachments: [],
};

export default function NewExpenseClaimPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TravelRequest[]>([]);
  const [title, setTitle] = useState('');
  const [travelRequestId, setTravelRequestId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<TravelRequest[]>('/travel/approved/mine').then(setTrips).catch(() => setTrips([]));
  }, []);

  const total = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    const validItems = items.filter((i) => i.description.trim() && i.amount > 0);
    if (validItems.length === 0) {
      setError('Add at least one item with a description and amount');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/expenses', {
        title,
        travelRequestId: travelRequestId || undefined,
        items: validItems.map((i) => ({
          description: i.description,
          amount: Number(i.amount),
          spentOn: i.spentOn,
          attachments: i.attachments.length ? i.attachments : undefined,
        })),
      });
      router.push(`/expenses/${created.id}`);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to submit expense claim');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader
        breadcrumb={[{ label: 'Expenses', href: '/expenses' }]}
        title="New Expense Claim"
        description="File an expense claim for something you paid for yourself, with receipts for approval"
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-danger">*</span></Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Client visit expenses"
          />
        </div>

        {trips.length > 0 && (
          <div className="space-y-1.5 max-w-sm">
            <Label htmlFor="travelRequestId">Linked Trip</Label>
            <select
              id="travelRequestId"
              value={travelRequestId}
              onChange={(e) => setTravelRequestId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Not linked to a trip</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.purpose} — {new Date(t.fromDate).toLocaleDateString()} to {new Date(t.toDate).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Items <span className="text-danger">*</span></Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <Card key={idx}>
                <CardContent className="space-y-3 pt-4">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6 space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        placeholder="e.g. Replacement monitor"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.amount}
                        onChange={(e) => updateItem(idx, { amount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Spent On</Label>
                      <Input
                        type="date"
                        value={item.spentOn}
                        onChange={(e) => updateItem(idx, { spentOn: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={items.length === 1}
                        onClick={() => removeItem(idx)}
                        className="text-danger hover:text-danger hover:bg-danger/10"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Receipts (image or PDF, optional, multiple allowed)</Label>
                    <AttachmentUploader
                      value={item.attachments}
                      onChange={(files) => updateItem(idx, { attachments: files })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end px-1">
            <span className="text-sm text-muted-foreground mr-2">Total</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Submit Expense Claim
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
