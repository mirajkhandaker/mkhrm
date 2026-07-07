'use client';

import { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ChangeLogEntry {
  id: string;
  changeSummary: string;
  createdAt: string;
  changedByUser?: { email: string };
}

interface ChangeHistoryTimelineProps {
  path: string; // e.g. `/travel/${id}/changes`
}

export function ChangeHistoryTimeline({ path }: ChangeHistoryTimelineProps) {
  const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<ChangeLogEntry[]>(path).then(setEntries).catch(() => setEntries([])).finally(() => setLoading(false));
  }, [path]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading history…
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No edits have been made since this request was submitted.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3">
          <History className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-foreground">{e.changeSummary}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {e.changedByUser?.email ?? 'Unknown'} · {new Date(e.createdAt).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
