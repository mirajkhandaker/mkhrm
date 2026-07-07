'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AssetUnit {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  serialNo: string | null;
  category?: { name: string };
  currentHolderSince: string;
  warrantyUntil: string | null;
}

export default function MyAssetsPage() {
  const [units, setUnits] = useState<AssetUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AssetUnit[]>('/assets/my').then(setUnits)
      .catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">My Assets</h1>
        <p className="text-sm text-muted-foreground">Everything currently assigned to you.</p>
      </div>

      {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="pt-4 text-sm text-danger">{error}</CardContent></Card>}

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : units.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Boxes className="h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium">Nothing assigned to you.</p>
          <p className="text-sm text-muted-foreground">Items assigned by HR will appear here.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <Card key={u.id}>
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/assets/${u.id}`} className="font-medium text-foreground hover:underline">{u.name}</Link>
                    <p className="text-xs font-mono text-muted-foreground">{u.assetTag}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{u.category?.name ?? ''}</Badge>
                </div>
                {u.serialNo && <p className="text-xs text-muted-foreground">S/N <span className="font-mono">{u.serialNo}</span></p>}
                <p className="text-xs text-muted-foreground">Held since {u.currentHolderSince}</p>
                {u.warrantyUntil && <p className="text-xs text-muted-foreground">Warranty until {u.warrantyUntil}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
