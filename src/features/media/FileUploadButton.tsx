import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { errorMessage } from '@/lib/utils';
import { mediaStatus, uploadFile, uploadLimits, type UploadPurpose, type UploadResult } from './upload';

export function useMediaEnabled() {
  return useQuery({ queryKey: ['media-status'], queryFn: mediaStatus, staleTime: 10 * 60_000 });
}

export function FileUploadButton({ purpose, ctx, onUploaded, label = 'Upload file', accept, variant = 'outline', disabled }: {
  purpose: UploadPurpose; ctx?: { courseId?: string; submissionId?: string }; onUploaded: (r: UploadResult, file: File) => void | Promise<void>; label?: string; accept?: string; variant?: 'outline' | 'secondary' | 'primary'; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const toast = useToast();
  const { data } = useMediaEnabled();
  if (data && !data.cloudinary) {
    return <p className="text-xs text-ink-500">File uploads are not configured on this server yet — paste a link instead.</p>;
  }
  return (
    <>
      <input ref={ref} type="file" className="sr-only" accept={accept ?? uploadLimits[purpose].accept} aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setPct(0);
            const r = await uploadFile(f, purpose, ctx, setPct);
            await onUploaded(r, f);
          } catch (err) {
            toast.error('Upload failed', errorMessage(err));
          } finally {
            setPct(null);
          }
        }} />
      <Button variant={variant} size="sm" disabled={disabled || pct != null} loading={pct != null} leftIcon={<Upload className="h-4 w-4" />} onClick={() => ref.current?.click()}>
        {pct != null ? `Uploading ${pct}%` : label}
      </Button>
      <span className="ml-2 text-xs text-ink-400">Max {uploadLimits[purpose].maxMb} MB</span>
    </>
  );
}
