'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { AttachmentUploader, StagedAttachment } from '@/components/attachments/attachment-uploader';
import { AttachmentList } from '@/components/attachments/attachment-list';

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  spentOn: string;
}

interface ExpenseClaim {
  id: string;
  title: string;
  status: string;
  items: ExpenseItem[];
}

interface ItemRow {
  id?: string;
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

export default function EditExpenseClaimPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ExpenseClaim>(`/expenses/${id}`)
      .then((claim) => {
        if (!['draft', 'pending', 'approved'].includes(claim.status)) {
          setLoadError('This claim can no longer be edited.');
          return;
        }
        setTitle(claim.title);
        setItems(claim.items.map((item) => ({
          id: item.id,
          description: item.description,
          amount: Number(item.amount),
          spentOn: item.spentOn,
          attachments: [],
        })));
      })
      .catch((e: ApiError) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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
      await api.patch(`/expenses/${id}`, {
        title,
        items: validItems.map((i) => ({
          id: i.id,
          description: i.description,
          amount: Number(i.amount),
          spentOn: i.spentOn,
          attachments: i.attachments.length ? i.attachments : undefined,
        })),
      });
      router.push(`/expenses/${id}`);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save changes');
    } finally {
      setSubmitting(false);
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
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader
        breadcrumb={[{ label: 'Expenses', href: '/expenses' }, { label: 'Claim', href: `/expenses/${id}` }]}
        title="Edit Expense Claim"
        description="Saving changes restarts approval from the first step"
      />

      {(error || loadError) && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error ?? loadError}</CardContent>
        </Card>
      )}

      {!loadError && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-danger">*</span></Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

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
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <Input
                          type="number" min={0} step={0.01}
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
                          type="button" variant="ghost" size="sm"
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
                      <Label className="text-xs">Receipts</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.id && <AttachmentList ownerType="expense_item" ownerId={item.id} emptyLabel="" />}
                        <AttachmentUploader
                          value={item.attachments}
                          onChange={(files) => updateItem(idx, { attachments: files })}
                        />
                      </div>
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
              Save & Resubmit for Approval
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
