import { useRef, useState } from 'react';
import { FileAudio, FileText, FileVideo, ImageIcon, Link2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { Button, Input, Spinner, useToast } from '@/components/ui';
import { cldUrl } from '@/lib/media';
import { cn, errorMessage } from '@/lib/utils';
import { uploadFile, type UploadPurpose, type UploadResult } from './upload';
import { useMediaEnabled } from './FileUploadButton';

type Kind = 'image' | 'video' | 'audio' | 'document' | 'any';
const ACCEPT: Record<Kind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml',
  video: 'video/mp4,video/webm',
  audio: 'audio/mpeg,audio/mp4,audio/ogg,audio/wav',
  document: 'application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip',
  any: 'image/*,video/mp4,video/webm,audio/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip',
};
const ICON: Record<Kind, typeof ImageIcon> = { image: ImageIcon, video: FileVideo, audio: FileAudio, document: FileText, any: FileText };

/**
 * Pick a file from the device (or drag & drop) and upload it to Cloudinary via
 * a signed request. Shows a preview. Video optionally accepts a YouTube/Vimeo
 * link, which streams more cheaply for learners on limited data.
 */
export function MediaPicker({ value, onChange, kind = 'image', purpose = 'course_media', courseId, label, allowLink, className, onUploaded }: {
  value?: string | null; onChange: (url: string) => void; kind?: Kind; purpose?: UploadPurpose; courseId?: string; label?: string; allowLink?: boolean; className?: string;
  onUploaded?: (r: UploadResult, file: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const toast = useToast();
  const { data: media } = useMediaEnabled();
  const Icon = ICON[kind];
  const enabled = media?.cloudinary !== false;

  const handle = async (file?: File) => {
    if (!file) return;
    try {
      setPct(0);
      const r = await uploadFile(file, purpose, { courseId }, setPct);
      onChange(r.secure_url);
      onUploaded?.(r, file);
    } catch (e) {
      toast.error('Upload failed', errorMessage(e));
    } finally {
      setPct(null);
    }
  };

  if (value && !linkMode) {
    return (
      <div className={cn('flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 p-2.5', className)}>
        {kind === 'image' ? <img src={cldUrl(value, { w: 160 })} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Icon className="h-6 w-6" /></span>}
        <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{value.split('/').pop()}</span>
        {enabled && <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => ref.current?.click()} loading={pct != null}>{pct != null ? `${pct}%` : 'Replace'}</Button>}
        <Button size="icon" variant="ghost" aria-label="Remove file" onClick={() => onChange('')}><Trash2 className="h-4 w-4" /></Button>
        <input ref={ref} type="file" className="sr-only" accept={ACCEPT[kind]} aria-label={label ?? 'Choose file'} onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    );
  }

  return (
    <div className={className}>
      {linkMode ? (
        <div className="flex gap-2">
          <Input autoFocus aria-label="Video link" placeholder="https://www.youtube.com/watch?v=…" defaultValue={value ?? ''} onBlur={(e) => e.target.value && onChange(e.target.value.trim())} />
          <Button variant="ghost" onClick={() => setLinkMode(false)}>Upload instead</Button>
        </div>
      ) : (
        <button type="button" disabled={!enabled || pct != null}
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files?.[0]); }}
          className={cn('flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition',
            drag ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-ink-50/60 hover:border-brand-300 hover:bg-brand-50/40', !enabled && 'cursor-not-allowed opacity-70')}>
          {pct != null ? <><Spinner /><span className="text-sm font-semibold text-ink-700">Uploading {pct}%</span><span className="h-1.5 w-40 overflow-hidden rounded-full bg-ink-200"><span className="block h-full bg-brand-600" style={{ width: `${pct}%` }} /></span></>
            : <>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-brand-600 shadow-sm"><UploadCloud className="h-5 w-5" /></span>
              <span className="text-sm font-semibold text-ink-800">{label ?? `Choose ${kind === 'any' || kind === 'document' ? 'a file' : `an ${kind === 'image' ? 'image' : kind === 'audio' ? 'audio file' : 'video'}`} from your device`}</span>
              <span className="text-xs text-ink-500">{enabled ? 'or drag and drop it here' : 'Uploads are not configured on this server yet'}</span>
            </>}
        </button>
      )}
      {allowLink && !linkMode && <button type="button" onClick={() => setLinkMode(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Link2 className="h-3.5 w-3.5" />Use a YouTube or Vimeo link instead (better for long videos)</button>}
      <input ref={ref} type="file" className="sr-only" accept={ACCEPT[kind]} aria-label={label ?? 'Choose file'} onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
