'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftCircle, Loader2, Upload } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ImportResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; message: string; raw: Record<string, string> }>;
}

export default function AssetsImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/assets/units/import', {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: { Authorization: `Bearer ${window.__accessToken ?? ''}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;
      setResult(body as ImportResult);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/assets')}>
          <ArrowLeftCircle className="h-4 w-4 mr-1.5" /> Back to inventory
        </Button>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Bulk Import Units</h1>
        <p className="text-sm text-muted-foreground">
          Seed pre-owned units from a CSV or XLSX export. Imports are idempotent by
          <span className="font-mono"> asset_tag</span>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="text-sm space-y-2">
            <p><strong>Required columns:</strong> <span className="font-mono">asset_tag, name, category_code, condition_code, location_code, purchased_on</span></p>
            <p><strong>Optional columns:</strong> <span className="font-mono">serial_no, purchase_cost, warranty_until, notes</span></p>
            <p className="text-muted-foreground text-xs">
              Rows with an existing <span className="font-mono">asset_tag</span> are skipped.
              Unknown category/condition/location codes fail the row.
            </p>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="h-4 w-4 mr-1.5" /> {busy ? 'Importing…' : 'Choose file'}
            </Button>
          </div>

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Importing…
            </div>
          )}

          {error && (
            <Card className="border-danger/30 bg-danger/5">
              <CardContent className="pt-4 text-sm text-danger">{error}</CardContent>
            </Card>
          )}

          {result && (
            <div className="text-sm space-y-1 rounded-md border border-border bg-muted/20 p-4">
              <div>Total rows: <span className="tabular-nums">{result.total}</span></div>
              <div>Inserted: <span className="text-success tabular-nums">{result.inserted}</span></div>
              <div>Skipped (existing tag): <span className="text-muted-foreground tabular-nums">{result.skipped}</span></div>
              <div>Errors: <span className="text-danger tabular-nums">{result.errors.length}</span></div>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-danger">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                  {result.errors.length > 20 && <li>… and {result.errors.length - 20} more</li>}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
