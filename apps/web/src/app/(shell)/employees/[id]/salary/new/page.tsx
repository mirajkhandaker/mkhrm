'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, RefreshCw, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface SalaryComponent {
  id: string;
  name: string;
  code: string;
  type: string;
  calcType: string;
  defaultValue: string | null;
  isActive: boolean;
}

interface LineItem {
  componentId: string;
  inputValue: string;
  enabled: boolean;
}

interface PreviewResult {
  basicAmount: number;
  grossAmount: number;
  netAmount: number;
  ctcAmount: number;
  employeePf: number;
  employerPf: number;
  lines: Array<{
    component: { name: string; type: string; code: string };
    calcType: string;
    inputValue: number | null;
    computedAmount: number;
  }>;
}

const REASON_LABELS: Record<string, string> = {
  initial: 'Initial (first-time)',
  increment: 'Annual increment',
  promotion: 'Promotion',
  revision: 'Salary revision',
};

export default function NewSalaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [inputBasis, setInputBasis] = useState<'basic' | 'gross'>('gross');
  const [inputAmount, setInputAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('initial');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    api.get<SalaryComponent[]>('/compensation/components').then((comps) => {
      const active = comps.filter((c) => c.isActive);
      setComponents(active);
      setLineItems(
        active.map((c) => ({
          componentId: c.id,
          inputValue: c.defaultValue ?? '',
          enabled: true,
        })),
      );
    });
  }, []);

  const buildBody = useCallback(() => ({
    inputBasis,
    inputAmount: Number(inputAmount),
    effectiveFrom,
    reason,
    lines: lineItems
      .filter((l) => l.enabled)
      .map((l) => {
        const comp = components.find((c) => c.id === l.componentId)!;
        return {
          componentId: l.componentId,
          inputValue: comp.calcType === 'remainder' ? undefined : (l.inputValue ? Number(l.inputValue) : undefined),
        };
      }),
  }), [inputBasis, inputAmount, effectiveFrom, reason, lineItems, components]);

  const runPreview = useCallback(async () => {
    if (!inputAmount || Number(inputAmount) <= 0) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const body = buildBody();
      const result = await api.post<PreviewResult>(
        `/compensation/salary/preview?employeeId=${id}`,
        body,
      );
      setPreview(result);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setPreviewError(err.message ?? 'Calculation failed');
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [buildBody, id, inputAmount]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.post(`/compensation/employees/${id}/salary`, buildBody());
      router.push(`/employees/${id}?tab=compensation`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setSaveError(err.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setLine = (componentId: string, field: keyof LineItem, value: string | boolean) => {
    setLineItems((prev) =>
      prev.map((l) => (l.componentId === componentId ? { ...l, [field]: value } : l)),
    );
  };

  const earningLines = lineItems.filter((l) => {
    const comp = components.find((c) => c.id === l.componentId);
    return comp?.type === 'earning';
  });

  const deductionLines = lineItems.filter((l) => {
    const comp = components.find((c) => c.id === l.componentId);
    return comp?.type === 'deduction';
  });

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Header */}
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Link href="/employees" className="hover:text-foreground hover:underline">Employees</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/employees/${id}?tab=compensation`} className="hover:text-foreground hover:underline">
            Compensation
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Set Salary</span>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-semibold">Set Salary Structure</h1>
            <p className="text-sm text-muted-foreground">Define earning and deduction components for this employee.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Config */}
        <div className="space-y-5">
          <div className="rounded-2xl bg-card p-5 shadow-sm space-y-4">
            <h2 className="font-medium text-foreground">Salary inputs</h2>

            <div className="space-y-1">
              <Label>Input basis</Label>
              <Select value={inputBasis} onValueChange={(v) => setInputBasis(v as 'basic' | 'gross')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">Enter Gross salary</SelectItem>
                  <SelectItem value="basic">Enter Basic salary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{inputBasis === 'gross' ? 'Gross amount' : 'Basic amount'}</Label>
              <Input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="e.g. 80000"
                className="font-mono tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <Label>Effective from</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Earning components */}
          {earningLines.length > 0 && (
            <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              <h2 className="font-medium text-foreground">Earnings</h2>
              {earningLines.map((l) => {
                const comp = components.find((c) => c.id === l.componentId)!;
                const isRemainder = comp.calcType === 'remainder';
                return (
                  <div key={l.componentId} className="flex items-center gap-3">
                    <Switch
                      checked={l.enabled}
                      onCheckedChange={(v) => setLine(l.componentId, 'enabled', v)}
                    />
                    <span className="text-sm flex-1 text-foreground">{comp.name}</span>
                    <span className="text-xs text-muted-foreground capitalize w-28">
                      {comp.calcType.replace(/_/g, ' ')}
                    </span>
                    {isRemainder ? (
                      <span className="w-28 text-right text-xs text-muted-foreground italic">auto</span>
                    ) : (
                      <Input
                        type="number"
                        className="w-28 text-right font-mono tabular-nums"
                        value={l.inputValue}
                        disabled={!l.enabled}
                        onChange={(e) => setLine(l.componentId, 'inputValue', e.target.value)}
                      />
                    )}
                    <span className="w-6 text-xs text-muted-foreground">
                      {comp.calcType.includes('percent') ? '%' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Deduction components */}
          {deductionLines.length > 0 && (
            <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              <h2 className="font-medium text-foreground">Deductions</h2>
              {deductionLines.map((l) => {
                const comp = components.find((c) => c.id === l.componentId)!;
                return (
                  <div key={l.componentId} className="flex items-center gap-3">
                    <Switch
                      checked={l.enabled}
                      onCheckedChange={(v) => setLine(l.componentId, 'enabled', v)}
                    />
                    <span className="text-sm flex-1 text-foreground">{comp.name}</span>
                    <span className="text-xs text-muted-foreground capitalize w-28">
                      {comp.calcType.replace(/_/g, ' ')}
                    </span>
                    <Input
                      type="number"
                      className="w-28 text-right font-mono tabular-nums"
                      value={l.inputValue}
                      disabled={!l.enabled}
                      onChange={(e) => setLine(l.componentId, 'inputValue', e.target.value)}
                    />
                    <span className="w-6 text-xs text-muted-foreground">
                      {comp.calcType.includes('percent') ? '%' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={runPreview} disabled={previewLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${previewLoading ? 'animate-spin' : ''}`} />
            Calculate preview
          </Button>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-5 shadow-sm min-h-48">
            <h2 className="font-medium text-foreground mb-4">Live preview</h2>

            {previewError && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger mb-3">
                {previewError}
              </div>
            )}

            {!preview && !previewLoading && !previewError && (
              <p className="text-sm text-muted-foreground">
                Fill in the inputs and click Calculate preview to see the breakdown.
              </p>
            )}

            {preview && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Basic', preview.basicAmount],
                    ['Gross', preview.grossAmount],
                    ['Net take-home', preview.netAmount],
                    ['CTC', preview.ctcAmount],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="font-mono text-sm font-semibold tabular-nums">
                        {Number(value).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {preview.employeePf > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">Employee PF</div>
                      <div className="font-mono text-sm tabular-nums text-danger">
                        − {preview.employeePf.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <div className="text-xs text-muted-foreground">Employer PF</div>
                      <div className="font-mono text-sm tabular-nums text-info">
                        {preview.employerPf.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Line breakdown */}
                <div className="border-t border-border pt-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Component breakdown</p>
                  {preview.lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            l.component.type === 'earning'
                              ? 'border-success/50 text-success text-[10px] px-1'
                              : 'border-danger/50 text-danger text-[10px] px-1'
                          }
                        >
                          {l.component.type === 'earning' ? '+' : '−'}
                        </Badge>
                        <span className="text-foreground">{l.component.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {l.computedAmount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save */}
          {saveError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{saveError}</p>
          )}
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving || !preview}
          >
            {saving ? 'Saving…' : 'Activate salary structure'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            This will supersede any existing active structure for this employee.
          </p>
        </div>
      </div>
    </div>
  );
}
