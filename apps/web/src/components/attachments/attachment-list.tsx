'use client';

import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { api, fetchReceiptBlobUrl } from '@/lib/api';

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
}

interface AttachmentListProps {
  ownerType: string;
  ownerId: string;
  emptyLabel?: string;
}

export function AttachmentList({ ownerType, ownerId, emptyLabel = 'No files attached' }: AttachmentListProps) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get<Attachment[]>(`/attachments?ownerType=${ownerType}&ownerId=${ownerId}`)
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [ownerType, ownerId]);

  async function open(id: string) {
    setOpening(id);
    try {
      await fetchReceiptBlobUrl(`/attachments/${id}/file`);
    } finally {
      setOpening(null);
    }
  }

  if (loading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (files.length === 0) return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => open(f.id)}
          disabled={opening === f.id}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground hover:border-primary hover:text-primary transition-colors"
        >
          {opening === f.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : f.mimeType.startsWith('image/') ? (
            <ImageIcon className="h-3.5 w-3.5" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          <span className="max-w-[140px] truncate">{f.fileName}</span>
        </button>
      ))}
    </div>
  );
}
