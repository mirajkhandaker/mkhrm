'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';

interface Step {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRef: string | null;
  isMandatory: boolean;
  slaHours: number | null;
  minMetricValue: string | null;
  maxMetricValue: string | null;
}
interface WorkflowDetail { id: string; name: string; entityType: string; isActive: boolean; steps: Step[]; }
interface RoleOption { id: string; name: string; }

const APPROVER_TYPES = [
  { value: 'line_manager', label: 'Direct manager' },
  { value: 'manager_chain_level', label: 'N levels up the reporting chain' },
  { value: 'role', label: 'Specific role' },
  { value: 'specific_user', label: 'Specific user (id)' },
  { value: 'department_head', label: 'Department head' },
];

const METRIC_LABEL: Record<string, string | null> = {
  leave: 'days requested',
  requisition: 'estimated cost ($)',
  travel_request: 'estimated cost ($)',
  expense_claim: 'claim total ($)',
  regularization: null,
};

// Editable row state mirrors Step but keeps numeric/text fields as plain strings for the inputs.
interface EditableStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRef: string;
  isMandatory: boolean;
  slaHours: string;
  minMetricValue: string;
  maxMetricValue: string;
  dirty: boolean;
}

function toEditable(s: Step): EditableStep {
  return {
    id: s.id,
    stepOrder: s.stepOrder,
    approverType: s.approverType,
    approverRef: s.approverRef ?? '',
    isMandatory: s.isMandatory,
    slaHours: s.slaHours != null ? String(s.slaHours) : '',
    minMetricValue: s.minMetricValue != null ? String(s.minMetricValue) : '',
    maxMetricValue: s.maxMetricValue != null ? String(s.maxMetricValue) : '',
    dirty: false,
  };
}

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingStep, setAddingStep] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<WorkflowDetail[]>('/workflows').then((all) => all.find((w) => w.id === id)),
      api.get<RoleOption[]>('/roles'),
    ])
      .then(([wf, roleList]) => {
        if (!wf) throw { message: 'Workflow not found' } as ApiError;
        setWorkflow(wf);
        setSteps(wf.steps.sort((a, b) => a.stepOrder - b.stepOrder).map(toEditable));
        setRoles(roleList);
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const metricLabel = workflow ? METRIC_LABEL[workflow.entityType] : null;

  function updateStep(stepId: string, patch: Partial<EditableStep>) {
    setSteps((rows) => rows.map((r) => (r.id === stepId ? { ...r, ...patch, dirty: true } : r)));
  }

  async function saveStep(row: EditableStep) {
    setSavingId(row.id);
    setError(null);
    try {
      await api.patch(`/workflows/${id}/steps/${row.id}`, {
        approverType: row.approverType,
        approverRef: row.approverRef || null,
        isMandatory: row.isMandatory,
        slaHours: row.slaHours ? Number(row.slaHours) : null,
        minMetricValue: row.minMetricValue ? Number(row.minMetricValue) : null,
        maxMetricValue: row.maxMetricValue ? Number(row.maxMetricValue) : null,
      });
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save step');
    } finally {
      setSavingId(null);
    }
  }

  async function removeStep(stepId: string) {
    setSavingId(stepId);
    setError(null);
    try {
      await api.delete(`/workflows/${id}/steps/${stepId}`);
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to remove step');
    } finally {
      setSavingId(null);
    }
  }

  async function addStep() {
    setAddingStep(true);
    setError(null);
    try {
      await api.post(`/workflows/${id}/steps`, {
        stepOrder: steps.length + 1,
        approverType: 'line_manager',
        isMandatory: true,
      });
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to add step');
    } finally {
      setAddingStep(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const reordered = [...steps];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setError(null);
    try {
      await api.patch(`/workflows/${id}/steps/reorder`, { stepIds: reordered.map((s) => s.id) });
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to reorder steps');
    }
  }

  const roleOptions = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <Card className="m-6 border-danger/30 bg-danger/5">
        <CardContent className="pt-4 text-sm text-danger">{error ?? 'Workflow not found'}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      <PageHeader
        breadcrumb={[{ label: 'Settings', href: '/settings' }, { label: 'Workflows', href: '/settings/workflows' }]}
        title={workflow.name}
        description={workflow.isActive ? 'Active — currently routes new requests' : 'Inactive — activate it from the workflows list when ready'}
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {steps.map((row, index) => (
          <Card key={row.id}>
            <CardContent className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {row.stepOrder}
                  </span>
                  <span className="text-sm font-medium text-foreground">Step {row.stepOrder}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={index === steps.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10"
                    disabled={savingId === row.id || steps.length <= 1}
                    onClick={() => removeStep(row.id)}
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Approver</Label>
                  <Select value={row.approverType} onValueChange={(v) => updateStep(row.id, { approverType: v, approverRef: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPROVER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {row.approverType === 'manager_chain_level' && (
                  <div className="space-y-1.5">
                    <Label>Levels up</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.approverRef}
                      onChange={(e) => updateStep(row.id, { approverRef: e.target.value })}
                      placeholder="1 = direct manager"
                    />
                  </div>
                )}

                {row.approverType === 'role' && (
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={row.approverRef} onValueChange={(v) => updateStep(row.id, { approverRef: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {row.approverType === 'specific_user' && (
                  <div className="space-y-1.5">
                    <Label>User id</Label>
                    <Input value={row.approverRef} onChange={(e) => updateStep(row.id, { approverRef: e.target.value })} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>SLA (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={row.slaHours}
                    onChange={(e) => updateStep(row.id, { slaHours: e.target.value })}
                  />
                </div>

                <div className="flex items-end gap-2 pb-1.5">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-[color:var(--primary)]"
                      checked={row.isMandatory}
                      onChange={(e) => updateStep(row.id, { isMandatory: e.target.checked })}
                    />
                    Mandatory
                  </label>
                </div>
              </div>

              {metricLabel && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Applies when {metricLabel} is at least</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.minMetricValue}
                      onChange={(e) => updateStep(row.id, { minMetricValue: e.target.value })}
                      placeholder="No minimum — always applies"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>And at most (optional)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.maxMetricValue}
                      onChange={(e) => updateStep(row.id, { maxMetricValue: e.target.value })}
                      placeholder="No upper bound"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" onClick={() => saveStep(row)} disabled={savingId === row.id || !row.dirty}>
                  {savingId === row.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                  Save step
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="outline" onClick={addStep} disabled={addingStep}>
        {addingStep ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
        Add step
      </Button>
    </div>
  );
}
