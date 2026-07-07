'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Save } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Setting {
  key: string;
  value: unknown;
}

interface SettingsForm {
  org_name: string;
  timezone: string;
  currency: string;
  fiscal_year_start: string;
  working_week: number[];
  basic_to_gross_min_ratio: number;
  allow_self_salary_view: boolean;
  terminated_data_retention_days: number;
}

const DEFAULTS: SettingsForm = {
  org_name: '',
  timezone: 'Asia/Dhaka',
  currency: 'BDT',
  fiscal_year_start: '01-01',
  working_week: [0, 1, 2, 3, 4],
  basic_to_gross_min_ratio: 0.5,
  allow_self_salary_view: false,
  terminated_data_retention_days: 730,
};

const WEEKDAYS = [
  { label: 'Mon', value: 0 },
  { label: 'Tue', value: 1 },
  { label: 'Wed', value: 2 },
  { label: 'Thu', value: 3 },
  { label: 'Fri', value: 4 },
  { label: 'Sat', value: 5 },
  { label: 'Sun', value: 6 },
];

function toForm(settings: Setting[]): SettingsForm {
  const map = new Map(settings.map((s) => [s.key, s.value]));
  return {
    org_name: (map.get('org_name') as string) ?? DEFAULTS.org_name,
    timezone: (map.get('timezone') as string) ?? DEFAULTS.timezone,
    currency: (map.get('currency') as string) ?? DEFAULTS.currency,
    fiscal_year_start: (map.get('fiscal_year_start') as string) ?? DEFAULTS.fiscal_year_start,
    working_week: (map.get('working_week') as number[]) ?? DEFAULTS.working_week,
    basic_to_gross_min_ratio: (map.get('basic_to_gross_min_ratio') as number) ?? DEFAULTS.basic_to_gross_min_ratio,
    allow_self_salary_view: (map.get('allow_self_salary_view') as boolean) ?? DEFAULTS.allow_self_salary_view,
    terminated_data_retention_days:
      (map.get('terminated_data_retention_days') as number) ?? DEFAULTS.terminated_data_retention_days,
  };
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings.manage');

  const [original, setOriginal] = useState<SettingsForm | null>(null);
  const [form, setForm] = useState<SettingsForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<Setting[]>('/settings')
      .then((settings) => {
        const next = toForm(settings);
        setForm(next);
        setOriginal(next);
      })
      .catch((e: ApiError) => setError(e.message ?? 'Failed to load settings'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function toggleWeekday(day: number) {
    setForm((f) => ({
      ...f,
      working_week: f.working_week.includes(day)
        ? f.working_week.filter((d) => d !== day)
        : [...f.working_week, day].sort((a, b) => a - b),
    }));
  }

  async function handleSave() {
    if (!original) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const changedKeys = (Object.keys(form) as Array<keyof SettingsForm>).filter(
        (key) => JSON.stringify(form[key]) !== JSON.stringify(original[key]),
      );
      await Promise.all(changedKeys.map((key) => api.patch(`/settings/${key}`, { value: form[key] })));
      setOriginal(form);
      setSuccess(changedKeys.length > 0 ? 'Settings saved' : 'No changes to save');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDirty = original !== null && JSON.stringify(form) !== JSON.stringify(original);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Organization-wide configuration that drives behavior across the app</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save Changes
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          You can view settings but don&apos;t have permission to change them.
        </div>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="org_name">Organization name</Label>
            <Input
              id="org_name"
              value={form.org_name}
              disabled={!canManage}
              onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.timezone}
              disabled={!canManage}
              placeholder="e.g. Asia/Dhaka"
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Attendance is resolved against this timezone.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              disabled={!canManage}
              placeholder="e.g. BDT"
              maxLength={3}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fiscal_year_start">Fiscal year start (MM-DD)</Label>
            <Input
              id="fiscal_year_start"
              value={form.fiscal_year_start}
              disabled={!canManage}
              placeholder="e.g. 01-01"
              onChange={(e) => setForm((f) => ({ ...f, fiscal_year_start: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working Week</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Days considered working days for attendance and leave day-counting.
          </p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const active = form.working_week.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  disabled={!canManage}
                  onClick={() => toggleWeekday(day.value)}
                  className={cn(
                    'rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted',
                    !canManage && 'cursor-not-allowed opacity-60',
                  )}
                  aria-pressed={active}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ratio">Minimum basic-to-gross ratio</Label>
            <Input
              id="ratio"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.basic_to_gross_min_ratio}
              disabled={!canManage}
              onChange={(e) => setForm((f) => ({ ...f, basic_to_gross_min_ratio: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              When entering salary as Gross, Basic must be at least this fraction of Gross.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="self-salary">Employees can view their own salary</Label>
            <div className="flex h-9 items-center">
              <Switch
                id="self-salary"
                checked={form.allow_self_salary_view}
                disabled={!canManage}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, allow_self_salary_view: checked }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Retention</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="retention">Terminated employee data retention (days)</Label>
            <Input
              id="retention"
              type="number"
              min={0}
              step={1}
              value={form.terminated_data_retention_days}
              disabled={!canManage}
              onChange={(e) => setForm((f) => ({ ...f, terminated_data_retention_days: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              Personal details for terminated employees are anonymized after this many days.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
