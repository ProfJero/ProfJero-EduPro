import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export const aiAvailable = () => Boolean(env.apiBase);

export type Citation = { code: string | null; title: string; kind?: string; framework?: string };
export type ChatEvent =
  | { type: 'meta'; conversation_id: string; remaining: number | null; citations: Citation[] }
  | { type: 'delta'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Please sign in to use the AI Companion.');
  return { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' };
}

/** Streams a tutor reply from the API worker (server-sent events). */
export async function streamChat(body: { conversation_id?: string; message: string; mode: string; lesson_id?: string; subject?: string; grade?: string }, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) {
  if (!env.apiBase) return onEvent({ type: 'error', message: 'The AI Companion service is not configured on this site yet.' });
  let res: Response;
  try {
    res = await fetch(`${env.apiBase}/api/ai/chat`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    return onEvent({ type: 'error', message: 'Could not reach the AI Companion. Check your connection.' });
  }
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return onEvent({ type: 'error', message: j.error ?? `The AI Companion is unavailable (${res.status}).` });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (data) { try { onEvent(JSON.parse(data) as ChatEvent); } catch { /* ignore partial */ } }
    }
  }
}

export type StudioTask = 'lesson_plan' | 'lesson_note' | 'questions' | 'scheme_of_work' | 'rubric' | 'worksheet';
export type GeneratedQuestion = { type: 'mcq' | 'true_false' | 'short_answer' | 'essay'; prompt: string; options?: string[]; answer?: string; explanation?: string; marks?: number; difficulty?: 'easy' | 'medium' | 'hard' };
export type StudioResult = { title: string; markdown?: string; questions?: GeneratedQuestion[]; citations: Citation[]; remaining: number | null };

export async function studioGenerate(body: Record<string, unknown>): Promise<StudioResult> {
  if (!env.apiBase) throw new Error('The Resource Studio AI service is not configured on this site yet.');
  const res = await fetch(`${env.apiBase}/api/ai/studio`, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as StudioResult & { error?: string };
  if (!res.ok) throw new Error(j.error ?? `Generation failed (${res.status}).`);
  return j;
}
