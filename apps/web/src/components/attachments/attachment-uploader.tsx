'use client';

import { useState } from 'react';
import { Paperclip, X, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface StagedAttachment {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

interface AttachmentUploaderProps {
  value: StagedAttachment[];
  onChange: (_files: StagedAttachment[]) => void;
  disabled?: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

// Uploads immediately to /attachments/stage (no owner known yet) and hands back plain
// file metadata — the parent form carries that metadata in its own submit payload so the
// owning item's create/update call can persist the real Attachment rows once it exists.
export function AttachmentUploader({ value, onChange, disabled }: AttachmentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: StagedAttachment[] = [];
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append('file', file);
        const result = await api.upload<StagedAttachment>('/attachments/stage', formData);
        uploaded.push(result);
      }
      onChange([...value, ...uploaded]);
    } catch (err: unknown) {
      setError((err as ApiError).message ?? 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((f, idx) => (
          <span
            key={`${f.fileUrl}-${idx}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-xs"
          >
            {f.mimeType.startsWith('image/') ? (
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="max-w-[140px] truncate">{f.fileName}</span>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-muted-foreground hover:text-danger"
              aria-label={`Remove ${f.fileName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <label
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground cursor-pointer',
            'hover:border-primary hover:text-primary transition-colors',
            (uploading || disabled) && 'opacity-50 pointer-events-none',
          )}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          Attach file
          <input
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            disabled={uploading || disabled}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
        </label>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
