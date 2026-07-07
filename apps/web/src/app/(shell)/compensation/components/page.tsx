'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: string;
  calcType: string;
  defaultValue: string | null;
  isPfApplicable: boolean;
  isTaxable: boolean;
  displayOrder: number;
  isActive: boolean;
}

const CALC_TYPE_LABELS: Record<string, string> = {
  fixed: 'Fixed amount',
  percent_of_basic: '% of Basic',
  percent_of_gross: '% of Gross',
  remainder: 'Remainder (Basic)',
};

const emptyForm = {
  name: '',
  code: '',
  type: 'earning',
  calcType: 'fixed',
  defaultValue: '',
  isPfApplicable: false,
  isTaxable: false,
  displayOrder: '0',
  isActive: true,
};

export default function SalaryComponentsPage() {
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryComponent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get<SalaryComponent[]>('/compensation/components')
      .then(setComponents)
      .catch(() => setError('Failed to load salary components.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setOpen(true);
  };

  const openEdit = (c: SalaryComponent) => {
    setEditing(c);
    setForm({
      name: c.name,
      code: c.code,
      type: c.type,
      calcType: c.calcType,
      defaultValue: c.defaultValue ?? '',
      isPfApplicable: c.isPfApplicable,
      isTaxable: c.isTaxable,
      displayOrder: String(c.displayOrder),
      isActive: c.isActive,
    });
    setFormError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    const body = {
      name: form.name,
      code: form.code,
      type: form.type,
      calcType: form.calcType,
      defaultValue: form.defaultValue ? Number(form.defaultValue) : undefined,
      isPfApplicable: form.isPfApplicable,
      isTaxable: form.isTaxable,
      displayOrder: Number(form.displayOrder),
      isActive: form.isActive,
    };
    try {
      if (editing) {
        await api.patch(`/compensation/components/${editing.id}`, body);
      } else {
        await api.post('/compensation/components', body);
      }
      setOpen(false);
      load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setFormError(err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this component? This cannot be undone.')) return;
    try {
      await api.delete(`/compensation/components/${id}`);
      load();
    } catch {
      alert('Failed to delete component.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading salary components…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-danger">
        <p>{error}</p>
        <Button variant="outline" onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Compensation', href: '/compensation' }]}
        title="Salary Components"
        description="Define earnings and deductions used in salary structures."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add component
          </Button>
        }
      />

      {components.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <p className="font-medium">No salary components yet</p>
          <p className="text-sm mt-1">Add your first component to start building salary structures.</p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add component
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Calc</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>PF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.map((c) => (
                <TableRow key={c.id} className="hover:bg-primary-soft/40">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.code}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        c.type === 'earning'
                          ? 'border-success text-success'
                          : 'border-danger text-danger'
                      }
                    >
                      {c.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {CALC_TYPE_LABELS[c.calcType] ?? c.calcType}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">
                    {c.defaultValue ?? '—'}
                  </TableCell>
                  <TableCell>
                    {c.isPfApplicable ? (
                      <Badge variant="outline" className="border-info text-info">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'default' : 'secondary'}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-danger hover:text-danger" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit component' : 'New salary component'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Code</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. HRA"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">Earning</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Calculation</Label>
                <Select value={form.calcType} onValueChange={(v) => setForm({ ...form, calcType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                    <SelectItem value="percent_of_basic">% of Basic</SelectItem>
                    <SelectItem value="percent_of_gross">% of Gross</SelectItem>
                    <SelectItem value="remainder">Remainder (Basic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Default value {form.calcType !== 'fixed' && form.calcType !== 'remainder' ? '(%)' : ''}</Label>
                <Input
                  type="number"
                  value={form.defaultValue}
                  onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
                  placeholder={form.calcType === 'remainder' ? 'N/A' : '0'}
                  disabled={form.calcType === 'remainder'}
                />
              </div>
              <div className="space-y-1">
                <Label>Display order</Label>
                <Input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <Label className="cursor-pointer">PF applicable</Label>
              <Switch
                checked={form.isPfApplicable}
                onCheckedChange={(v) => setForm({ ...form, isPfApplicable: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <Label className="cursor-pointer">Taxable</Label>
              <Switch
                checked={form.isTaxable}
                onCheckedChange={(v) => setForm({ ...form, isTaxable: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <Label className="cursor-pointer">Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create component'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
