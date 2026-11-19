import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type UploadPurpose = 'avatar' | 'course_media' | 'submission';
export type UploadResult = { public_id: string; resource_type: 'image' | 'video' | 'raw'; format?: string; version: string; bytes: number; secure_url: string; original_filename?: string; type: string };

const LIMITS: Record<UploadPurpose, { maxMb: number; accept: string }> = {
  avatar: { maxMb: 2, accept: 'image/jpeg,image/png,image/webp' },
  course_media: { maxMb: 50, accept: 'image/*,video/mp4,video/webm,audio/mpeg,audio/mp4,application/pdf' },
  submission: { maxMb: 10, accept: 'image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.py,.ipynb' },
};
export const uploadLimits = LIMITS;

async function api<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again.');
  const res = await fetch(`${env.apiBase}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

/** Signed upload: the server checks permissions and signs; the secret never reaches the browser. */
export async function uploadFile(file: File, purpose: UploadPurpose, ctx: { courseId?: string; submissionId?: string } = {}, onProgress?: (pct: number) => void): Promise<UploadResult> {
  const lim = LIMITS[purpose];
  if (file.size > lim.maxMb * 1024 * 1024) throw new Error(`File is too large. Maximum is ${lim.maxMb} MB.`);
  const sig = await api<{ cloud_name: string; api_key: string; timestamp: number; signature: string; folder: string; type: string; resource_type: string; public_id?: string }>('/api/media/sign', { purpose, course_id: ctx.courseId, submission_id: ctx.submissionId, filename: file.name, mime: file.type, size: file.size });
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.api_key);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('type', sig.type);
  if (sig.public_id) form.append('public_id', sig.public_id);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloud_name}/${sig.resource_type}/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const j = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ...j, version: String(j.version) } as UploadResult);
      else reject(new Error(j?.error?.message ?? 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.send(form);
  });
}

/** Short-lived, permission-checked link to a private submission file. */
export async function getSubmissionFileUrl(fileId: string): Promise<string> {
  const r = await api<{ url: string }>('/api/media/submission-url', { file_id: fileId });
  return r.url;
}

export async function mediaStatus(): Promise<{ cloudinary: boolean }> {
  try {
    const r = await fetch(`${env.apiBase}/api/health`);
    const j = (await r.json()) as { cloudinary?: boolean };
    return { cloudinary: Boolean(j.cloudinary) };
  } catch {
    return { cloudinary: false };
  }
}
