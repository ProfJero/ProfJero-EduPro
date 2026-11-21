import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type Connections = { available: { zoom: boolean; google_meet: boolean; jaas: boolean }; connected: { provider: string; account_email: string | null; connected_at: string }[] };

export async function liveApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!env.apiBase) throw new Error('The ProfJero Edu API service is not configured on this site.');
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${env.apiBase}${path}`, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: { authorization: `Bearer ${data.session?.access_token ?? ''}`, 'content-type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status})`);
  return j;
}

export const providerSlug = (p: string) => (p === 'google_meet' ? 'google' : p);
