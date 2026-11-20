import type { Env } from './env';

export const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type User = { id: string; token: string; email?: string; is_anonymous?: boolean };

export async function getUser(req: Request, env: Env): Promise<User | null> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY } });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string; email?: string; is_anonymous?: boolean };
  return u.id ? { id: u.id, token, email: u.email, is_anonymous: u.is_anonymous } : null;
}

/** PostgREST call as the signed-in user (RLS applies) or anonymously. */
export async function rest<T>(env: Env, token: string | null, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token ?? env.SUPABASE_ANON_KEY}`, apikey: env.SUPABASE_ANON_KEY!, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data: data as T };
}

export const rpc = <T>(env: Env, token: string | null, fn: string, args: Record<string, unknown>) =>
  rest<T>(env, token, `rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

export function b64url(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const enc = new TextEncoder();

export async function hmac(key: string | Uint8Array<ArrayBuffer>, data: string | Uint8Array<ArrayBuffer>) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, typeof data === 'string' ? enc.encode(data) : data));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function body<T>(req: Request, max = 200_000): Promise<T> {
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, 'Request too large');
  try { return JSON.parse(text || '{}') as T; } catch { throw new HttpError(400, 'Invalid JSON'); }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
