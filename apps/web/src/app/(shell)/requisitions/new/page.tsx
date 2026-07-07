'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/layout/page-header';
import { getRequisitionTypeCopy } from '@/lib/requisition-copy';

interface ItemRow {
  name: string;
  quantity: number;
  unitCost: number;
  note: string;
}

const EMPTY_ITEM: ItemRow = { name: '', quantity: 1, unitCost: 0, note: '' };

export default function NewRequisitionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: 'asset',
    title: '',
    description: '',
    priority: 'medium',
    neededBy: '',
  });
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const copy = getRequisitionTypeCopy(form.type);

  const total = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

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
    if (!form.title.trim()) {
      setError('Please enter a title');
      return;
    }
    const validItems = items.filter((i) => i.name.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      setError('Add at least one item with a name and quantity');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/requisitions', {
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        neededBy: form.neededBy || undefined,
        items: validItems.map((i) => ({
          name: i.name,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          note: i.note || undefined,
        })),
      });
      router.push(`/requisitions/${created.id}`);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to submit requisition');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <PageHeader
        breadcrumb={[{ label: 'Requisitions', href: '/requisitions' }]}
        title="New Requisition"
        description="Submit an asset, purchase or recruitment request for approval"
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="asset">Asset</option>
              <option value="purchase">Purchase</option>
              <option value="recruitment">Recruitment</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-danger">*</span></Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={copy.titlePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder={copy.descriptionPlaceholder}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="resize-none"
          />
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label htmlFor="neededBy">Needed By</Label>
          <Input
            id="neededBy"
            type="date"
            value={form.neededBy}
            onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))}
          />
        </div>

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{copy.itemsLabel} <span className="text-danger">*</span></Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add {copy.itemNameLabel}
            </Button>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{copy.itemNameLabel}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">{copy.qtyLabel}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-40">{copy.unitCostLabel}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36">Subtotal</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-48">{copy.noteLabel}</th>
                    <th className="px-4 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <Input
                          value={item.name}
                          onChange={(e) => updateItem(idx, { name: e.target.value })}
                          placeholder={copy.itemNamePlaceholder}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitCost}
                          onChange={(e) => updateItem(idx, { unitCost: Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-4 py-2 tabular-nums text-foreground">
                        ${((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)).toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={item.note}
                          onChange={(e) => updateItem(idx, { note: e.target.value })}
                          placeholder={copy.notePlaceholder}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={items.length === 1}
                          onClick={() => removeItem(idx)}
                          className="text-danger hover:text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground mr-2">{copy.totalLabel}</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">${total.toFixed(2)}</span>
            </div>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Submit Requisition
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
