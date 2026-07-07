'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Upload, CheckCircle, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

type Step = 'upload' | 'map' | 'preview' | 'done';

interface ImportRow {
  id: string;
  rowNumber: number;
  status: 'ok' | 'warning' | 'error';
  message: string | null;
  parsed: { employeeCode?: string; deviceUserId?: string; workDate?: string } | null;
}

interface CommitResult {
  id: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
}

const ROW_STYLES: Record<string, string> = {
  ok: 'border-success text-success bg-success/5',
  warning: 'border-warning text-warning bg-warning/5',
  error: 'border-danger text-danger bg-danger/5',
};

const ROW_ICON: Record<string, typeof CheckCircle> = {
  ok: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

export default function AttendanceImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [headerRow, setHeaderRow] = useState<string[]>([]);

  const [employeeCodeColumn, setEmployeeCodeColumn] = useState('');
  const [deviceUserIdColumn, setDeviceUserIdColumn] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [timeColumns, setTimeColumns] = useState<string[]>([]);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rolledBack, setRolledBack] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload<{ batchId: string; headerRow: string[] }>('/attendance/import/upload', formData);
      setBatchId(result.batchId);
      setHeaderRow(result.headerRow);
      setStep('map');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to upload file');
    } finally {
      setWorking(false);
    }
  }

  function toggleTimeColumn(col: string) {
    setTimeColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
  }

  async function handleMapAndValidate() {
    if (!batchId || !dateColumn || timeColumns.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      await api.post(`/attendance/import/${batchId}/map`, {
        employeeCodeColumn: employeeCodeColumn || undefined,
        deviceUserIdColumn: deviceUserIdColumn || undefined,
        dateColumn,
        timeColumns,
      });
      const validated = await api.post<ImportRow[]>(`/attendance/import/${batchId}/validate`, {});
      setRows(validated);
      setStep('preview');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to map and validate the file');
    } finally {
      setWorking(false);
    }
  }

  async function handleCommit() {
    if (!batchId) return;
    setWorking(true);
    setError(null);
    try {
      const result = await api.post<CommitResult>(`/attendance/import/${batchId}/commit`, {});
      setCommitResult(result);
      setStep('done');
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to commit the import');
    } finally {
      setWorking(false);
    }
  }

  async function handleRollback() {
    if (!batchId) return;
    setWorking(true);
    setError(null);
    try {
      await api.post(`/attendance/import/${batchId}/rollback`, {});
      setRolledBack(true);
      setShowRollbackConfirm(false);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to roll back the import');
    } finally {
      setWorking(false);
    }
  }

  const counts = {
    ok: rows.filter((r) => r.status === 'ok').length,
    warning: rows.filter((r) => r.status === 'warning').length,
    error: rows.filter((r) => r.status === 'error').length,
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        breadcrumb={[{ label: 'Attendance', href: '/attendance' }]}
        title="Import Attendance"
        description="Upload a device export, map columns, and commit valid rows"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
              step === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
            )}>
              {i + 1}
            </span>
            <span className={cn('capitalize', step === s && 'text-foreground font-medium')}>{s}</span>
            {i < 3 && <ArrowRight className="h-3 w-3" />}
          </div>
        ))}
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {step === 'upload' && (
        <Card>
          <CardHeader><CardTitle>1. Upload file</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="file">Attendance export (.xlsx or .csv)</Label>
              <input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary-soft/80"
              />
            </div>
            <Button onClick={handleUpload} disabled={!file || working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}
              Upload
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'map' && (
        <Card>
          <CardHeader><CardTitle>2. Map columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="empCol">Employee code column</Label>
                <select
                  id="empCol"
                  value={employeeCodeColumn}
                  onChange={(e) => setEmployeeCodeColumn(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">None</option>
                  {headerRow.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="devCol">Device ID column (fallback)</Label>
                <select
                  id="devCol"
                  value={deviceUserIdColumn}
                  onChange={(e) => setDeviceUserIdColumn(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">None</option>
                  {headerRow.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateCol">Date column <span className="text-danger">*</span></Label>
                <select
                  id="dateCol"
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  required
                >
                  <option value="">Select…</option>
                  {headerRow.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Punch time column(s) <span className="text-danger">*</span></Label>
              <p className="text-xs text-muted-foreground">Multiple punches will be collapsed to first-in / last-out.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {headerRow.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => toggleTimeColumn(h)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      timeColumns.includes(h)
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleMapAndValidate} disabled={working || !dateColumn || timeColumns.length === 0}>
              {working && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Continue to preview
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader><CardTitle>3. Preview & confirm</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 text-sm">
              <Badge variant="outline" className="border-success text-success">{counts.ok} ok</Badge>
              <Badge variant="outline" className="border-warning text-warning">{counts.warning} warning</Badge>
              <Badge variant="outline" className="border-danger text-danger">{counts.error} error</Badge>
            </div>

            <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Row</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Employee</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const Icon = ROW_ICON[r.status];
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-2">{r.parsed?.employeeCode ?? r.parsed?.deviceUserId ?? '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{r.parsed?.workDate ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', ROW_STYLES[r.status])}>
                            <Icon className="h-3 w-3" />
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.message ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button onClick={handleCommit} disabled={working || counts.ok + counts.warning === 0}>
              {working && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Commit valid rows
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'done' && commitResult && (
        <Card>
          <CardHeader><CardTitle>4. Done</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {rolledBack ? (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
                This import has been rolled back. Records it created were removed.
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                Committed {commitResult.successRows} of {commitResult.totalRows} rows ({commitResult.status}).
              </div>
            )}

            <div className="flex gap-3">
              <Button asChild>
                <Link href="/attendance/team">View team attendance</Link>
              </Button>
              {!rolledBack && (
                <Button variant="outline" className="text-danger hover:text-danger" onClick={() => setShowRollbackConfirm(true)}>
                  Rollback this import
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showRollbackConfirm} onOpenChange={setShowRollbackConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback this import?</DialogTitle>
            <DialogDescription>
              This removes attendance records that this import created. It cannot restore records
              this import overwrote — those will keep their imported values. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollbackConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRollback} disabled={working}>
              {working && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Roll back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
