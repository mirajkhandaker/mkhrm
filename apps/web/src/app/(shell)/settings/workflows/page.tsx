'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitBranch, Loader2, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';

interface WorkflowStep { id: string; stepOrder: number; }
interface WorkflowRow {
  id: string;
  name: string;
  entityType: string;
  isActive: boolean;
  steps: WorkflowStep[];
}

const ENTITY_TYPES = ['leave', 'requisition', 'travel_request', 'expense_claim', 'regularization'];
const ENTITY_LABELS: Record<string, string> = {
  leave: 'Leave',
  requisition: 'Requisition',
  travel_request: 'Travel Request',
  expense_claim: 'Expense Claim',
  regularization: 'Regularization',
};

export default function WorkflowsAdminPage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState(ENTITY_TYPES[0]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<WorkflowRow[]>('/workflows')
      .then(setWorkflows)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(wf: WorkflowRow) {
    setTogglingId(wf.id);
    try {
      await api.patch(`/workflows/${wf.id}/toggle`, { isActive: !wf.isActive });
      load();
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to update workflow');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const wf = await api.post<WorkflowRow>('/workflows', {
        name,
        entityType,
        isActive: false,
        steps: [{ stepOrder: 1, approverType: 'line_manager', isMandatory: true }],
      });
      setOpen(false);
      setName('');
      window.location.href = `/settings/workflows/${wf.id}`;
    } catch (err: unknown) {
      setCreateError((err as ApiError).message ?? 'Failed to create workflow');
    } finally {
      setCreating(false);
    }
  }

  const byEntityType = ENTITY_TYPES.map((type) => ({
    type,
    workflows: workflows.filter((w) => w.entityType === type),
  }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Settings', href: '/settings' }]}
        title="Workflows"
        description="Define the approval chain for each request type — steps, hierarchy levels, and thresholds"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" />New workflow</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New workflow</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wf-name">Name</Label>
                  <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High-Value Requisition Approval" />
                </div>
                <div className="space-y-1.5">
                  <Label>Applies to</Label>
                  <Select value={entityType} onValueChange={setEntityType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{ENTITY_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created inactive with one starter step — add more and activate it from the editor.
                </p>
                {createError && <p className="text-sm text-danger">{createError}</p>}
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                  {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Create workflow
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {byEntityType.map(({ type, workflows: rows }) => (
            <div key={type}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {ENTITY_LABELS[type]}
              </h2>
              {rows.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                    <GitBranch className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No workflow configured for this request type.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {rows.map((wf) => (
                    <Card key={wf.id}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div>
                          <Link href={`/settings/workflows/${wf.id}`} className="font-medium text-foreground hover:text-primary">
                            {wf.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{wf.steps.length} step{wf.steps.length === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={wf.isActive ? 'text-xs font-medium text-success' : 'text-xs text-muted-foreground'}>
                            {wf.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <Switch
                            checked={wf.isActive}
                            disabled={togglingId === wf.id}
                            onCheckedChange={() => handleToggle(wf)}
                          />
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/settings/workflows/${wf.id}`}>Edit steps</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
