'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, CheckCircle, Download } from 'lucide-react';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  requiresDocument: boolean;
  accrualMethod: string;
  defaultDaysPerYear: number;
  maxCarryForward: number;
  allowNegativeBalance: boolean;
  color: string;
  isActive: boolean;
}

const ACCRUAL_LABELS: Record<string, string> = {
  none: 'No accrual',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const DEFAULT_FORM = {
  name: '',
  code: '',
  isPaid: true,
  requiresDocument: false,
  accrualMethod: 'none',
  defaultDaysPerYear: 0,
  maxCarryForward: 0,
  allowNegativeBalance: false,
  color: '#6B8CCF',
};

export default function LeaveAdminPage() {
  const { hasPermission } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadFile(`/reports/export/leave-balances?year=${new Date().getFullYear()}&format=xlsx`, 'leave-balances.xlsx');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to export');
    } finally {
      setExporting(false);
    }
  }

  function load() {
    api.get<LeaveType[]>('/leave/types?all=true')
      .then(setLeaveTypes)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setForm({ ...DEFAULT_FORM });
    setEditId(null);
    setShowForm(true);
    setError(null);
  }

  function startEdit(lt: LeaveType) {
    setForm({
      name: lt.name,
      code: lt.code,
      isPaid: lt.isPaid,
      requiresDocument: lt.requiresDocument,
      accrualMethod: lt.accrualMethod,
      defaultDaysPerYear: Number(lt.defaultDaysPerYear),
      maxCarryForward: Number(lt.maxCarryForward),
      allowNegativeBalance: lt.allowNegativeBalance,
      color: lt.color,
    });
    setEditId(lt.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editId) {
        await api.patch(`/leave/types/${editId}`, form);
        setSuccess('Leave type updated');
      } else {
        await api.post('/leave/types', form);
        setSuccess('Leave type created');
      }
      setShowForm(false);
      setEditId(null);
      setLoading(true);
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this leave type? Existing balances and applications are unaffected.')) return;
    try {
      await api.delete(`/leave/types/${id}`);
      setLeaveTypes((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to deactivate');
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
      <PageHeader
        breadcrumb={[{ label: 'Leave', href: '/leave' }]}
        title="Leave Types"
        description="Configure leave types and their accrual rules"
        actions={
          <>
            {hasPermission('reports.view') && (
              <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                Export Balances
              </Button>
            )}
            <Button size="sm" onClick={startCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Leave Type
            </Button>
          </>
        }
      />

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? 'Edit Leave Type' : 'New Leave Type'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name <span className="text-danger">*</span></Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sick Leave"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Code <span className="text-danger">*</span></Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SICK"
                  disabled={!!editId}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accrualMethod">Accrual</Label>
                <select
                  id="accrualMethod"
                  value={form.accrualMethod}
                  onChange={(e) => setForm((f) => ({ ...f, accrualMethod: e.target.value }))}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="none">No accrual</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defaultDaysPerYear">Days per Year</Label>
                <Input
                  id="defaultDaysPerYear"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.defaultDaysPerYear}
                  onChange={(e) => setForm((f) => ({ ...f, defaultDaysPerYear: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxCarryForward">Max Carry Forward</Label>
                <Input
                  id="maxCarryForward"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.maxCarryForward}
                  onChange={(e) => setForm((f) => ({ ...f, maxCarryForward: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-9 w-16 p-1"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPaid}
                    onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Paid leave
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresDocument}
                    onChange={(e) => setForm((f) => ({ ...f, requiresDocument: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Requires document
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowNegativeBalance}
                    onChange={(e) => setForm((f) => ({ ...f, allowNegativeBalance: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Allow negative balance
                </label>
              </div>
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  {editId ? 'Save Changes' : 'Create Leave Type'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowForm(false); setEditId(null); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Leave Types Table */}
      {leaveTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Plus className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No leave types configured</p>
            <p className="text-sm text-muted-foreground">Add leave types to allow employees to apply for leave.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Code</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days/Year</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accrual</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flags</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
                        <span className="font-medium text-foreground">{lt.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{lt.code}</code>
                    </td>
                    <td className="px-5 py-3 tabular-nums">{Number(lt.defaultDaysPerYear).toFixed(1)}</td>
                    <td className="px-5 py-3">{ACCRUAL_LABELS[lt.accrualMethod] ?? lt.accrualMethod}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lt.isPaid && <Badge variant="outline" className="text-xs border-success text-success">Paid</Badge>}
                        {lt.requiresDocument && <Badge variant="outline" className="text-xs border-warning text-warning">Doc required</Badge>}
                        {lt.allowNegativeBalance && <Badge variant="outline" className="text-xs border-info text-info">Neg. balance</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          lt.isActive ? 'border-success text-success' : 'border-border text-muted-foreground',
                        )}
                      >
                        {lt.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(lt)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {lt.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger hover:bg-danger/10"
                            onClick={() => handleDeactivate(lt.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
