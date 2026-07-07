'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AttachmentUploader, StagedAttachment } from '@/components/attachments/attachment-uploader';
import { AttachmentList } from '@/components/attachments/attachment-list';

export interface LegRow {
  id?: string;
  description: string;
  category: string;
  transportMode: string;
  fromLocation: string;
  toLocation: string;
  isRoundTrip: boolean;
  fromDate: string;
  toDate: string;
  estimatedCost: number;
  note: string;
  attachments: StagedAttachment[];
}

export interface TravelRequestFormValue {
  purpose: string;
  timing: 'pre_trip' | 'post_trip';
  fromDate: string;
  toDate: string;
  advanceRequested: number;
  legs: LegRow[];
}

const CATEGORY_OPTIONS = [
  { value: 'travel', label: 'Transport' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'meals', label: 'Meals' },
  { value: 'misc', label: 'Misc' },
];

export const EMPTY_LEG: LegRow = {
  description: '',
  category: 'travel',
  transportMode: '',
  fromLocation: '',
  toLocation: '',
  isRoundTrip: false,
  fromDate: new Date().toISOString().slice(0, 10),
  toDate: new Date().toISOString().slice(0, 10),
  estimatedCost: 0,
  note: '',
  attachments: [],
};

interface TravelRequestFormProps {
  value: TravelRequestFormValue;
  onChange: (_value: TravelRequestFormValue) => void;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  // Timing can only be chosen at creation — an edit form passes this to show it read-only.
  lockTiming?: boolean;
}

export function TravelRequestForm({ value, onChange, submitting, submitLabel, error, onSubmit, onCancel, lockTiming }: TravelRequestFormProps) {
  const [advanceMode, setAdvanceMode] = useState<'full' | 'partial'>(
    value.advanceRequested > 0 ? 'partial' : 'full',
  );
  const isPostTrip = value.timing === 'post_trip';
  const todayStr = new Date().toISOString().slice(0, 10);

  const total = value.legs.reduce((sum, l) => sum + (Number(l.estimatedCost) || 0), 0);

  function set<K extends keyof TravelRequestFormValue>(key: K, val: TravelRequestFormValue[K]) {
    onChange({ ...value, [key]: val });
  }

  function updateLeg(index: number, patch: Partial<LegRow>) {
    onChange({ ...value, legs: value.legs.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  }

  function updateLegFromDate(index: number, newFromDate: string) {
    const leg = value.legs[index];
    updateLeg(index, { fromDate: newFromDate, toDate: leg.toDate < newFromDate ? newFromDate : leg.toDate });
  }

  function addLeg() {
    onChange({ ...value, legs: [...value.legs, { ...EMPTY_LEG }] });
  }

  function removeLeg(index: number) {
    onChange({ ...value, legs: value.legs.filter((_, i) => i !== index) });
  }

  function handleAdvanceModeChange(mode: 'full' | 'partial') {
    setAdvanceMode(mode);
    if (mode === 'full') set('advanceRequested', total);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="space-y-5"
    >
      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="purpose">Purpose <span className="text-danger">*</span></Label>
        <Input
          id="purpose"
          value={value.purpose}
          onChange={(e) => set('purpose', e.target.value)}
          placeholder="e.g. Client onboarding visit"
        />
      </div>

      <div className="space-y-1.5">
        <Label>When are you traveling?</Label>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            disabled={lockTiming}
            onClick={() => set('timing', 'pre_trip')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              value.timing === 'pre_trip' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Before the trip
          </button>
          <button
            type="button"
            disabled={lockTiming}
            onClick={() => set('timing', 'post_trip')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              value.timing === 'post_trip' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Already traveled
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isPostTrip
            ? "You've already traveled and paid out of pocket — no advance, reimbursed once approved."
            : 'Request approval and an advance before you travel; settle actual vs. estimated cost afterward.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="fromDate">From Date <span className="text-danger">*</span></Label>
          <Input
            id="fromDate"
            type="date"
            value={value.fromDate}
            max={isPostTrip ? todayStr : undefined}
            onChange={(e) => set('fromDate', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="toDate">To Date <span className="text-danger">*</span></Label>
          <Input
            id="toDate"
            type="date"
            value={value.toDate}
            min={value.fromDate}
            max={isPostTrip ? todayStr : undefined}
            onChange={(e) => set('toDate', e.target.value)}
          />
        </div>
      </div>

      {/* Advance — not applicable once you've already traveled */}
      {!isPostTrip && (
        <div className="space-y-1.5">
          <Label>Advance Requested</Label>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => handleAdvanceModeChange('full')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  advanceMode === 'full' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Full advance
              </button>
              <button
                type="button"
                onClick={() => handleAdvanceModeChange('partial')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  advanceMode === 'partial' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Partial advance
              </button>
            </div>
            <Input
              type="number"
              min={0}
              step={0.01}
              disabled={advanceMode === 'full'}
              value={advanceMode === 'full' ? total : value.advanceRequested}
              onChange={(e) => set('advanceRequested', Number(e.target.value))}
              className="max-w-[160px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Full advance requests the entire estimated cost up front; partial lets you ask for less.
          </p>
        </div>
      )}

      {/* Legs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Journey Costs <span className="text-danger">*</span></Label>
          <Button type="button" variant="outline" size="sm" onClick={addLeg}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Cost
          </Button>
        </div>
        <div className="space-y-3">
          {value.legs.map((leg, idx) => {
            const isTransport = leg.category === 'travel';
            return (
              <Card key={idx}>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-36 shrink-0 space-y-1">
                      <Label className="text-xs">Category</Label>
                      <select
                        value={leg.category}
                        onChange={(e) => updateLeg(idx, { category: e.target.value })}
                        className="flex h-9 w-full rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {isTransport && (
                      <div className="w-32 shrink-0 space-y-1">
                        <Label className="text-xs">Transport</Label>
                        <select
                          value={leg.transportMode}
                          onChange={(e) => updateLeg(idx, { transportMode: e.target.value })}
                          className="flex h-9 w-full rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <option value="">Unspecified</option>
                          <option value="flight">Flight</option>
                          <option value="train">Train</option>
                          <option value="bus">Bus</option>
                          <option value="car">Car</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    )}

                    {isTransport && (
                      <div className="w-36 flex-1 min-w-[140px] space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input
                          value={leg.fromLocation}
                          onChange={(e) => updateLeg(idx, { fromLocation: e.target.value })}
                          placeholder="e.g. Dhaka"
                        />
                      </div>
                    )}

                    {isTransport && (
                      <div className="w-36 flex-1 min-w-[140px] space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input
                          value={leg.toLocation}
                          onChange={(e) => updateLeg(idx, { toLocation: e.target.value })}
                          placeholder="e.g. Chittagong"
                        />
                      </div>
                    )}

                    {isTransport && (
                      <div className="shrink-0 space-y-1">
                        <Label className="text-xs">Return</Label>
                        <div className="flex h-9 items-center gap-2">
                          <Switch
                            checked={leg.isRoundTrip}
                            onCheckedChange={(checked) => updateLeg(idx, { isRoundTrip: checked })}
                          />
                          <span className="text-xs text-muted-foreground">
                            {leg.isRoundTrip ? 'Round trip' : 'One way'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-[200px] space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={leg.description}
                        onChange={(e) => updateLeg(idx, { description: e.target.value })}
                        placeholder="e.g. Hotel stay, team dinner, visa fee"
                      />
                    </div>

                    <div className="w-40 shrink-0 space-y-1">
                      <Label className="text-xs">From Date</Label>
                      <Input
                        type="date"
                        value={leg.fromDate}
                        max={isPostTrip ? todayStr : undefined}
                        onChange={(e) => updateLegFromDate(idx, e.target.value)}
                      />
                    </div>

                    <div className="w-40 shrink-0 space-y-1">
                      <Label className="text-xs">To Date</Label>
                      <Input
                        type="date"
                        value={leg.toDate}
                        min={leg.fromDate}
                        max={isPostTrip ? todayStr : undefined}
                        onChange={(e) => updateLeg(idx, { toDate: e.target.value })}
                      />
                    </div>

                    <div className="w-32 shrink-0 space-y-1">
                      <Label className="text-xs">Estimated Cost</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={leg.estimatedCost}
                        onChange={(e) => updateLeg(idx, { estimatedCost: Number(e.target.value) })}
                      />
                    </div>

                    <div className="flex-1 min-w-[160px] space-y-1">
                      <Label className="text-xs">Note</Label>
                      <Input
                        value={leg.note}
                        onChange={(e) => updateLeg(idx, { note: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>

                    <div className="flex-1 min-w-[220px] space-y-1">
                      <Label className="text-xs">Proof (image or PDF, optional)</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        {leg.id && <AttachmentList ownerType="travel_request_item" ownerId={leg.id} emptyLabel="" />}
                        <AttachmentUploader
                          value={leg.attachments}
                          onChange={(files) => updateLeg(idx, { attachments: files })}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={value.legs.length === 1}
                        onClick={() => removeLeg(idx)}
                        className="text-danger hover:text-danger hover:bg-danger/10"
                        aria-label="Remove cost"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="flex justify-end px-1">
          <span className="text-sm text-muted-foreground mr-2">Total Estimated Cost</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
